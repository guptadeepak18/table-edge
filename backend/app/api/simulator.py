import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sse_starlette.sse import EventSourceResponse
from app.core.database import get_db
from app.models.simulator import Spin, GameSession, CustomConditionOption
from app.schemas.game import SpinRequest, SpinResponse, HotColdStatsResponse
from app.schemas.strategy import (
    BacktestConfig, BacktestResult,
    AdvancedBacktestConfig, AdvancedBacktestResult,
    ConditionOptionsListResponse, CustomOptionCreate, CustomOptionResponse,
    NaturalLanguageStrategyRequest, NaturalLanguageStrategyResponse,
    AIConditionSuggestionRequest, AIConditionSuggestionResponse
)
from app.services.rng_service import rng_service
from app.services.payout_service import payout_service
from app.services.backtest_service import backtest_service
from app.services.nl_strategy_service import nl_strategy_service
from app.services.ai_advisor_service import ai_advisor_service
from app.core.constants import EUR_WHEEL_SEQUENCE, USA_WHEEL_SEQUENCE

router = APIRouter(prefix="/simulator", tags=["simulator"])

async def compute_db_hot_cold(db: AsyncSession, rules: str):
    """
    Computes frequency distribution and Hot/Cold numbers across all recorded spins in the database table.
    """
    stmt = (
        select(Spin.pocket_number, func.count(Spin.id).label("freq"))
        .where(Spin.rules == rules)
        .group_by(Spin.pocket_number)
    )
    res = await db.execute(stmt)
    freq_map = {str(row[0]): int(row[1]) for row in res.all()}

    seq = EUR_WHEEL_SEQUENCE if rules == "EUR" else USA_WHEEL_SEQUENCE

    # Sort all pockets descending by historical frequency; ties maintain sequence order
    sorted_pockets = sorted(seq, key=lambda p: freq_map.get(str(p), 0), reverse=True)
    hot_numbers = sorted_pockets[:5]
    cold_numbers = sorted_pockets[-5:]
    total_spins = sum(freq_map.values())

    return hot_numbers, cold_numbers, total_spins, freq_map

@router.post("/spin", response_model=SpinResponse)
async def execute_spin(req: SpinRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes a single server-side cryptographically secure spin, calculates payouts,
    records the spin to the database with all session/strategy details,
    and returns updated historical Hot & Cold numbers computed across all sessions.
    """
    pocket, color, rng_method, seed_hash, ts = rng_service.generate_spin(req.rules)
    total_bet, total_payout, net_win = payout_service.calculate_payout(req.bets, pocket, req.rules)

    # 1. Manage / Link GameSession
    session_id = req.session_id
    if session_id:
        sess_res = await db.execute(select(GameSession).where(GameSession.id == session_id))
        sess = sess_res.scalar_one_or_none()
        if not sess:
            sess = GameSession(
                id=session_id,
                user_id=req.user_id,
                rules=req.rules,
                starting_bankroll=req.client_bankroll or 1000.0,
                ending_bankroll=(req.client_bankroll or 1000.0) + net_win,
            )
            db.add(sess)
        else:
            sess.ending_bankroll = (req.client_bankroll or sess.ending_bankroll) + net_win
    else:
        session_id = str(uuid.uuid4())
        sess = GameSession(
            id=session_id,
            user_id=req.user_id,
            rules=req.rules,
            starting_bankroll=req.client_bankroll or 1000.0,
            ending_bankroll=(req.client_bankroll or 1000.0) + net_win,
        )
        db.add(sess)

    # 2. Persist Spin Record with all associated metadata
    spin_id = str(uuid.uuid4())
    resulting_bankroll = (req.client_bankroll + total_payout) if req.client_bankroll is not None else None

    spin = Spin(
        id=spin_id,
        session_id=session_id,
        user_id=req.user_id,
        strategy_name=req.strategy_name or "Manual Bet",
        strategy_level=req.level_number or 1,
        rules=req.rules,
        pocket_number=str(pocket),
        color=color,
        total_bet=total_bet,
        total_payout=total_payout,
        net_win=net_win,
        resulting_bankroll=resulting_bankroll,
        bet_details=[b.model_dump() for b in req.bets],
        rng_method=rng_method,
        seed_hash=seed_hash,
    )
    db.add(spin)
    await db.commit()

    # 3. Compute cross-session historical Hot & Cold numbers from the database table
    hot_numbers, cold_numbers, total_spins, _ = await compute_db_hot_cold(db, req.rules)

    return SpinResponse(
        id=spin_id,
        pocket_number=pocket,
        color=color,
        total_bet=total_bet,
        total_payout=total_payout,
        net_win=net_win,
        resulting_bankroll=resulting_bankroll,
        rng_method=rng_method,
        seed_hash=seed_hash,
        timestamp=ts,
        hot_numbers=hot_numbers,
        cold_numbers=cold_numbers,
        total_spins_recorded=total_spins,
    )

@router.get("/stats/hot-cold", response_model=HotColdStatsResponse)
async def get_hot_cold_stats(rules: str = "EUR", db: AsyncSession = Depends(get_db)):
    """
    Returns Hot & Cold numbers and pocket frequency distribution calculated across ALL recorded spins in the database.
    """
    hot, cold, total, freq = await compute_db_hot_cold(db, rules)
    return HotColdStatsResponse(
        total_spins=total,
        rules=rules,
        hot_numbers=hot,
        cold_numbers=cold,
        frequencies=freq,
    )

async def ensure_min_historical_spins(db: AsyncSession, min_count: int = 500):
    try:
        import datetime
        res = await db.execute(select(func.count(Spin.id)))
        count = res.scalar() or 0
        if count < min_count:
            sess_res = await db.execute(select(GameSession))
            sess = sess_res.scalars().first()
            if not sess:
                sess = GameSession(
                    id="historical-session",
                    rules="EUR",
                    starting_bankroll=10000.0,
                    ending_bankroll=10000.0,
                )
                db.add(sess)
                await db.commit()
            session_id = sess.id

            needed = min_count - count
            now = datetime.datetime.now(datetime.timezone.utc)
            new_spins = []
            for i in range(needed):
                pocket, color, rng_m, seed_h, _ = rng_service.generate_spin("EUR")
                ts = now - datetime.timedelta(minutes=(needed - i) * 2)
                s = Spin(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    user_id=sess.user_id,
                    strategy_name="Historical Spin",
                    strategy_level=1,
                    rules="EUR",
                    pocket_number=str(pocket),
                    color=color,
                    total_bet=0.0,
                    total_payout=0.0,
                    net_win=0.0,
                    resulting_bankroll=10000.0,
                    bet_details=[],
                    rng_method="secrets.randbelow",
                    seed_hash=seed_h,
                    created_at=ts,
                )
                new_spins.append(s)
            db.add_all(new_spins)
            await db.commit()
    except Exception as e:
        print(f"Historical spins seeding check skipped: {e}")

@router.get("/spins")
async def list_recorded_spins(
    limit: int = 500,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns historical spins recorded in the database across sessions.
    """
    if not session_id:
        await ensure_min_historical_spins(db, min_count=limit)

    stmt = select(Spin)
    if session_id:
        stmt = stmt.where(Spin.session_id == session_id)
    stmt = stmt.order_by(Spin.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    spins = res.scalars().all()
    return [
        {
            "id": s.id,
            "session_id": s.session_id,
            "user_id": s.user_id,
            "strategy_name": s.strategy_name,
            "strategy_level": s.strategy_level,
            "rules": s.rules,
            "pocket_number": s.pocket_number,
            "color": s.color,
            "total_bet": s.total_bet,
            "total_payout": s.total_payout,
            "net_win": s.net_win,
            "resulting_bankroll": s.resulting_bankroll,
            "bet_details": s.bet_details,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in spins
    ]

@router.post("/backtest", response_model=BacktestResult)
async def run_backtest(config: BacktestConfig):
    """
    Executes a Monte Carlo backtest with arbitrary progression levels.
    """
    return backtest_service.run_simulation(config)

@router.post("/backtest/stream")
async def stream_backtest(config: BacktestConfig):
    """
    Server-Sent Events endpoint streaming backtest progress.
    """
    def event_generator():
        for event in backtest_service.stream_simulation(config):
            yield {"event": "message", "data": event}

    return EventSourceResponse(event_generator())

@router.post("/backtest/advanced", response_model=AdvancedBacktestResult)
async def run_advanced_backtest(config: AdvancedBacktestConfig):
    """
    Executes an institutional advanced strategy backtest with custom condition builder,
    loss/win classification, expectancy ratios, and AI advisor recommendations.
    """
    return backtest_service.run_advanced_simulation(config)

@router.get("/conditions/options", response_model=ConditionOptionsListResponse)
async def list_condition_options(db: AsyncSession = Depends(get_db)):
    """
    Returns all standard and community-registered condition triggers, actions, and comparisons.
    """
    base_triggers = [
        {"value": "total_loss", "label": "Total Loss", "description": "Zero payout — all placed bets lost on spin", "category": "trigger", "is_custom": False},
        {"value": "partial_loss", "label": "Partial Loss", "description": "Some bets won, but net spin return is negative", "category": "trigger", "is_custom": False},
        {"value": "any_loss", "label": "Any Loss", "description": "Either total loss or partial loss", "category": "trigger", "is_custom": False},
        {"value": "push", "label": "Push / Break-Even", "description": "Payout equals total wager (net $0 return)", "category": "trigger", "is_custom": False},
        {"value": "partial_win", "label": "Partial Win", "description": "Net profit, but below maximum payout tier", "category": "trigger", "is_custom": False},
        {"value": "max_win", "label": "Max Win", "description": "Hit highest payout pocket or primary bet target", "category": "trigger", "is_custom": False},
        {"value": "any_win", "label": "Any Win", "description": "Any spin resulting in a positive net return", "category": "trigger", "is_custom": False},
        {"value": "consecutive_losses", "label": "Consecutive Losses", "description": "Triggers when consecutive loss streak reaches N spins", "category": "trigger", "is_custom": False},
        {"value": "consecutive_wins", "label": "Consecutive Wins", "description": "Triggers when consecutive win streak reaches N spins", "category": "trigger", "is_custom": False},
        {"value": "consecutive_pushes", "label": "Consecutive Pushes", "description": "Triggers when consecutive push streak reaches N spins", "category": "trigger", "is_custom": False},
        {"value": "consecutive_non_wins", "label": "Consecutive Non-Wins", "description": "Triggers when non-winning streak reaches N spins", "category": "trigger", "is_custom": False},
        {"value": "new_peak", "label": "New Peak Balance", "description": "Bankroll reaches a new session high-water mark", "category": "trigger", "is_custom": False},
        {"value": "profit_loss", "label": "Profit / Loss Milestone", "description": "Cumulative session or spin monetary threshold", "category": "trigger", "is_custom": False},
        {"value": "drawdown_gte", "label": "Session Drawdown ($) ≥", "description": "Peak-to-trough drop reaches or exceeds monetary amount", "category": "trigger", "is_custom": False},
        {"value": "drawdown_percent_gte", "label": "Session Drawdown (%) ≥", "description": "Peak-to-trough drop reaches percentage of peak", "category": "trigger", "is_custom": False},
        {"value": "bankroll_remaining_lte", "label": "Bankroll Remaining ≤", "description": "Active bankroll falls to or below threshold", "category": "trigger", "is_custom": False},
        {"value": "session_roi_gte", "label": "Session ROI (%) ≥", "description": "Total session ROI reaches target percent", "category": "trigger", "is_custom": False},
        {"value": "level_reached", "label": "Level Reached (Exact)", "description": "Progression reaches specific level L", "category": "trigger", "is_custom": False},
        {"value": "level_at_least", "label": "Level At Least (≥ L)", "description": "Progression is at or above level L", "category": "trigger", "is_custom": False},
        {"value": "spin_count_reached", "label": "Spin Count Reached", "description": "Triggers at spin #N or every N spins", "category": "trigger", "is_custom": False},
        {"value": "bet_size_gte", "label": "Total Bet Size ≥", "description": "Single spin total wager reaches or exceeds $", "category": "trigger", "is_custom": False},
    ]

    base_actions = [
        {"value": "increase_level", "label": "Step Up Progression Level", "description": "Advance forward by +N higher wager level(s)", "category": "action", "is_custom": False},
        {"value": "decrease_level", "label": "Step Down Progression Level", "description": "Step backward by −N lower wager level(s)", "category": "action", "is_custom": False},
        {"value": "goto_level", "label": "Jump to Specific Level", "description": "Go directly to a chosen progression level", "category": "action", "is_custom": False},
        {"value": "revert_to_level", "label": "Revert to Safety Level", "description": "Revert to chosen level (e.g. L1) while preserving multiplier", "category": "action", "is_custom": False},
        {"value": "keep_level", "label": "Stay at Current Level", "description": "Maintain level — adjust multiplier only", "category": "action", "is_custom": False},
        {"value": "reset_to_start", "label": "Reset to Base Bet (L1 · 1.0×)", "description": "Return to Level 1 with 1.0× multiplier and fresh counters", "category": "action", "is_custom": False},
        {"value": "increase_multiplier", "label": "Increase Bet Multiplier (+N)", "description": "Additively scale current bet multiplier (+1, +2, etc.)", "category": "action", "is_custom": False},
        {"value": "decrease_multiplier", "label": "Decrease Bet Multiplier (−N)", "description": "Reduce current bet multiplier (min 1.0×)", "category": "action", "is_custom": False},
        {"value": "multiply_by", "label": "Scale Multiplier by Factor (×N)", "description": "Geometric multiplication (e.g. 1.5×, 2×, 2.5×)", "category": "action", "is_custom": False},
        {"value": "set_multiplier", "label": "Set Exact Multiplier (N×)", "description": "Directly set bet multiplier to specific value", "category": "action", "is_custom": False},
        {"value": "double_multiplier", "label": "Double Current Bet (2×)", "description": "Multiplies active multiplier by 2", "category": "action", "is_custom": False},
        {"value": "triple_multiplier", "label": "Triple Current Bet (3×)", "description": "Multiplies active multiplier by 3", "category": "action", "is_custom": False},
        {"value": "half_multiplier", "label": "Halve Current Bet (0.5×)", "description": "Divides active multiplier by 2 (min 1.0×)", "category": "action", "is_custom": False},
        {"value": "reset_multiplier", "label": "Reset Multiplier to 1.0×", "description": "Resets multiplier to 1.0× without changing level", "category": "action", "is_custom": False},
        {"value": "reset_streak_counters", "label": "Reset Streak Counters", "description": "Clears win/loss/push streaks without resetting level or bet", "category": "action", "is_custom": False},
        {"value": "stop_simulation", "label": "Halt Session Early", "description": "Immediately exits session and locks current balance", "category": "action", "is_custom": False},
    ]

    base_comparisons = [
        {"value": "session_profit_incremental", "label": "Incremental Session Profit Target", "description": "Auto-advances goal step each time target is hit", "category": "comparison", "is_custom": False},
        {"value": "session_profit_gte", "label": "Cumulative Session Profit ≥", "description": "Fixed cumulative profit monetary threshold", "category": "comparison", "is_custom": False},
        {"value": "session_loss_gte", "label": "Cumulative Session Loss ≥", "description": "Fixed cumulative loss monetary threshold", "category": "comparison", "is_custom": False},
        {"value": "spin_profit_gte", "label": "Single Spin Profit ≥", "description": "Single spin net win monetary threshold", "category": "comparison", "is_custom": False},
        {"value": "spin_loss_gte", "label": "Single Spin Loss ≥", "description": "Single spin net loss monetary threshold", "category": "comparison", "is_custom": False},
        {"value": "peak_profit_giveback", "label": "Profit Giveback from Peak ≥", "description": "Profit retraces/drops by $X from its session peak", "category": "comparison", "is_custom": False},
        {"value": "spin_profit_pct_wager", "label": "Single Spin Return ≥ N× Wager", "description": "Payout is at least N times the spin wager amount", "category": "comparison", "is_custom": False},
    ]

    # Query DB for community options
    stmt = select(CustomConditionOption).order_by(CustomConditionOption.created_at.asc())
    res = await db.execute(stmt)
    custom_opts = res.scalars().all()

    existing_trigger_vals = {t["value"] for t in base_triggers}
    existing_action_vals = {a["value"] for a in base_actions}
    existing_comp_vals = {c["value"] for c in base_comparisons}

    for opt in custom_opts:
        item = {
            "value": opt.value,
            "label": opt.label,
            "description": opt.description or f"Custom option created by community",
            "category": opt.category,
            "is_custom": True,
        }
        if opt.category == "trigger" and opt.value not in existing_trigger_vals:
            base_triggers.append(item)
            existing_trigger_vals.add(opt.value)
        elif opt.category == "action" and opt.value not in existing_action_vals:
            base_actions.append(item)
            existing_action_vals.add(opt.value)
        elif opt.category == "comparison" and opt.value not in existing_comp_vals:
            base_comparisons.append(item)
            existing_comp_vals.add(opt.value)

    return {
        "triggers": base_triggers,
        "actions": base_actions,
        "comparisons": base_comparisons,
    }

@router.post("/conditions/options", response_model=CustomOptionResponse)
async def create_custom_condition_option(
    req: CustomOptionCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new custom trigger or action into the database for all users.
    """
    clean_val = req.value.strip().lower().replace(" ", "_")
    stmt = select(CustomConditionOption).where(CustomConditionOption.value == clean_val)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    new_opt = CustomConditionOption(
        id=str(uuid.uuid4()),
        category=req.category,
        value=clean_val,
        label=req.label,
        description=req.description,
        parameters_schema=req.parameters_schema,
        created_by=req.created_by or "user",
    )
    db.add(new_opt)
    await db.commit()
    await db.refresh(new_opt)
    return new_opt

@router.post("/strategy/parse-natural-language", response_model=NaturalLanguageStrategyResponse)
async def parse_natural_language_strategy(
    req: NaturalLanguageStrategyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Parses a natural language strategy description into progression levels, parameters,
    and workflow rules. Novel options are automatically saved to the database.
    """
    return await nl_strategy_service.parse_strategy(
        prompt=req.prompt,
        rules=req.rules,
        db=db,
    )

@router.post("/ai-suggest-conditions", response_model=AIConditionSuggestionResponse)
async def ai_suggest_conditions(req: AIConditionSuggestionRequest):
    """
    Analyzes the selected strategy layout, pocket coverage, and payoff profile to
    synthesize optimized workflow automation conditions for maximum winning chances.
    Uses user-configured AI models (OpenRouter GPT-4o-mini / DeepSeek, NVIDIA NIM).
    """
    return await ai_advisor_service.suggest_conditions(req)



