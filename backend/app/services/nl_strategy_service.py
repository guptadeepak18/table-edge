import json
import re
import uuid
from typing import Optional, List, Dict, Any, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.constants import RED_NUMBERS, BLACK_NUMBERS
from app.models.simulator import CustomConditionOption
from app.schemas.game import ProgressionLevel, BetPlacement, GameRules
from app.schemas.strategy import (
    StrategyCondition,
    StrategyExecutionParameters,
    NaturalLanguageStrategyResponse,
    CustomOptionResponse,
)

STANDARD_TRIGGERS = {
    "total_loss", "partial_loss", "any_loss",
    "partial_win", "max_win", "any_win",
    "profit_loss", "new_peak",
    "consecutive_losses", "consecutive_wins", "drawdown_gte"
}

STANDARD_ACTIONS = {
    "increase_level", "decrease_level", "goto_level",
    "reset_to_start", "keep_level",
    "increase_multiplier", "decrease_multiplier",
    "double_multiplier", "triple_multiplier", "half_multiplier",
    "stop_simulation"
}

STANDARD_COMPARISONS = {
    "session_profit_gte", "session_loss_gte",
    "spin_profit_gte", "spin_loss_gte",
    "session_profit_incremental"
}

def get_covered_pockets_for_bet(bet_type: str, rules: str = "EUR") -> Tuple[List[Any], float]:
    """Returns canonical covered pockets and payout multiplier for standard roulette bet types."""
    b = bet_type.lower().replace("-", "_").replace(" ", "_")
    red_pockets = sorted(list(RED_NUMBERS))
    black_pockets = sorted(list(BLACK_NUMBERS))

    if b in ("outside_red", "red"):
        return red_pockets, 1.0
    if b in ("outside_black", "black"):
        return black_pockets, 1.0
    if b in ("outside_even", "even"):
        return [n for n in range(1, 37) if n % 2 == 0], 1.0
    if b in ("outside_odd", "odd"):
        return [n for n in range(1, 37) if n % 2 != 0], 1.0
    if b in ("outside_low", "low", "1_18"):
        return list(range(1, 19)), 1.0
    if b in ("outside_high", "high", "19_36"):
        return list(range(19, 37)), 1.0
    if b in ("dozen_1", "1st_dozen", "doz1", "first_dozen"):
        return list(range(1, 13)), 2.0
    if b in ("dozen_2", "2nd_dozen", "doz2", "second_dozen"):
        return list(range(13, 25)), 2.0
    if b in ("dozen_3", "3rd_dozen", "doz3", "third_dozen"):
        return list(range(25, 37)), 2.0
    if b in ("column_1", "col1", "1st_column"):
        return [n for n in range(1, 37) if n % 3 == 1], 2.0
    if b in ("column_2", "col2", "2nd_column"):
        return [n for n in range(1, 37) if n % 3 == 2], 2.0
    if b in ("column_3", "col3", "3rd_column"):
        return [n for n in range(1, 37) if n % 3 == 0], 2.0

    return red_pockets, 1.0

class NaturalLanguageStrategyService:

    @classmethod
    async def parse_strategy(
        cls,
        prompt: str,
        rules: GameRules = "EUR",
        db: Optional[AsyncSession] = None
    ) -> NaturalLanguageStrategyResponse:
        """
        Translates a natural language strategy description into full execution parameters,
        progression levels with bet placements, and workflow conditions.
        Automatically registers any novel triggers or actions into the database.
        """
        openrouter_key = settings.OPENROUTER_API_KEY

        parsed_data = None
        used_model = None

        if openrouter_key:
            try:
                parsed_data = await cls._call_openrouter_llm(prompt, rules, openrouter_key)
                used_model = "OpenRouter (GPT-4o-mini)"
            except Exception as e:
                print(f"[NL Strategy Service] OpenRouter call failed: {e}. Falling back to deterministic parser.")

        if not parsed_data:
            parsed_data = cls._deterministic_fallback_parser(prompt, rules)
            used_model = used_model or "Deterministic Hybrid Rule Parser"

        # Check for novel conditions and persist to DB
        new_options = []
        if db and parsed_data.get("novel_conditions"):
            new_options = await cls._persist_novel_options(parsed_data["novel_conditions"], db)

        # Assemble schemas
        params_dict = parsed_data.get("parameters", {})
        execution_params = StrategyExecutionParameters(
            bankroll=float(params_dict.get("bankroll", 1000.0)),
            total_spins=int(params_dict.get("total_spins", 100)),
            total_sessions=int(params_dict.get("total_sessions", 10)),
            stop_loss=float(params_dict["stop_loss"]) if params_dict.get("stop_loss") else None,
            target_profit=float(params_dict["target_profit"]) if params_dict.get("target_profit") else None,
        )

        levels_list: List[ProgressionLevel] = []
        for raw_lvl in parsed_data.get("levels", []):
            placements: List[BetPlacement] = []
            for raw_b in raw_lvl.get("placements", []):
                pockets, def_mult = get_covered_pockets_for_bet(raw_b.get("bet_type", "outside_red"), rules)
                # If pockets provided explicitly in placement, use them
                cov = raw_b.get("covered_pockets") or pockets
                mult = float(raw_b.get("multiplier") or def_mult)
                amt = float(raw_b.get("amount", 10.0))
                placements.append(
                    BetPlacement(
                        id=f"bet-{uuid.uuid4().hex[:6]}",
                        bet_type=raw_b.get("bet_type", "outside_red"),
                        covered_pockets=cov,
                        amount=amt,
                        multiplier=mult,
                    )
                )
            total_w = sum(b.amount for b in placements) if placements else float(raw_lvl.get("total_wager", 10.0))
            levels_list.append(
                ProgressionLevel(
                    level_number=int(raw_lvl.get("level_number", len(levels_list) + 1)),
                    total_wager=total_w,
                    placements=placements
                )
            )

        if not levels_list:
            # Default level 1: Red 10
            pockets, mult = get_covered_pockets_for_bet("outside_red", rules)
            levels_list.append(
                ProgressionLevel(
                    level_number=1,
                    total_wager=10.0,
                    placements=[
                        BetPlacement(
                            id=f"bet-{uuid.uuid4().hex[:6]}",
                            bet_type="outside_red",
                            covered_pockets=pockets,
                            amount=10.0,
                            multiplier=mult,
                        )
                    ]
                )
            )

        conditions_list: List[StrategyCondition] = []
        for raw_c in parsed_data.get("conditions", []):
            conditions_list.append(
                StrategyCondition(
                    id=raw_c.get("id") or f"cond-nl-{uuid.uuid4().hex[:6]}",
                    trigger=raw_c.get("trigger", "total_loss"),
                    triggerCount=int(raw_c.get("trigger_count", raw_c.get("triggerCount", 1))),
                    comparison=raw_c.get("comparison"),
                    thresholdAmount=float(raw_c["threshold_amount"]) if raw_c.get("threshold_amount") is not None else (float(raw_c["thresholdAmount"]) if raw_c.get("thresholdAmount") is not None else None),
                    thresholdIncrement=float(raw_c["threshold_increment"]) if raw_c.get("threshold_increment") is not None else (float(raw_c["thresholdIncrement"]) if raw_c.get("thresholdIncrement") is not None else None),
                    action=raw_c.get("action", "increase_level"),
                    actionValue=int(raw_c.get("action_value", raw_c.get("actionValue", 1))),
                    multiplier=float(raw_c.get("multiplier", 1.0)),
                    multiplierMode=raw_c.get("multiplier_mode", raw_c.get("multiplierMode", "fixed")),
                    reason=raw_c.get("reason"),
                )
            )

        return NaturalLanguageStrategyResponse(
            strategy_name=parsed_data.get("strategy_name", "Natural Language Strategy"),
            explanation=parsed_data.get("explanation", "Custom strategy generated from your description."),
            rules=rules,
            parameters=execution_params,
            levels=levels_list,
            conditions=conditions_list,
            new_options_created=new_options,
            used_ai_model=used_model,
        )

    @classmethod
    async def _call_openrouter_llm(cls, prompt: str, rules: str, api_key: str) -> Dict[str, Any]:
        """Calls OpenRouter with structured prompt to parse roulette strategies."""
        system_prompt = f"""You are the quantitative Strategy Architect for TableEdge roulette backtester.
Analyze the user's natural language roulette betting strategy and output strict JSON.

Roulette Rules: {rules}
Wheel Pockets: {37 if rules == "EUR" else 38} pockets.

Standard Bet Types:
- "outside_red", "outside_black", "outside_even", "outside_odd", "outside_low" (1-18), "outside_high" (19-36) [Payout 1:1, mult 1.0]
- "dozen_1" (1-12), "dozen_2" (13-24), "dozen_3" (25-36) [Payout 2:1, mult 2.0]
- "column_1", "column_2", "column_3" [Payout 2:1, mult 2.0]
- "straight" (1 pocket, e.g. [17], payout 35:1)
- "split" (2 adjacent pockets, payout 17:1)
- "street" (3 pockets row, payout 11:1)
- "corner" (4 pockets square, payout 8:1)
- "sixline" (6 pockets double row, payout 5:1)

Standard Triggers:
"total_loss", "partial_loss", "any_loss", "partial_win", "max_win", "any_win", "profit_loss", "new_peak", "consecutive_losses", "consecutive_wins", "drawdown_gte"

Standard Actions:
"increase_level", "decrease_level", "goto_level", "reset_to_start", "keep_level", "increase_multiplier", "decrease_multiplier", "double_multiplier", "triple_multiplier", "half_multiplier", "stop_simulation"

Standard Comparisons (for profit_loss trigger):
"session_profit_gte", "session_loss_gte", "spin_profit_gte", "spin_loss_gte", "session_profit_incremental"

IMPORTANT - NOVEL CONDITIONS:
If the user's strategy concept specifies a trigger, action, or comparison NOT in the standard lists above (for example: "switch_to_opposite_color", "drawdown_pct_gte", "consecutive_pushes", "pause_spins"), create a novel slug for it and declare it in the "novel_conditions" array with category ("trigger", "action", or "comparison"), slug (lowercase snake_case), label (clear title), and description!

Required JSON format:
{{
  "strategy_name": "Title of Strategy",
  "explanation": "2-3 sentences explaining how this system bets and scales.",
  "parameters": {{
    "bankroll": 1000.0,
    "total_spins": 100,
    "total_sessions": 10,
    "stop_loss": 300.0 or null,
    "target_profit": 500.0 or null
  }},
  "levels": [
    {{
      "level_number": 1,
      "total_wager": 15.0,
      "placements": [
        {{ "bet_type": "outside_black", "amount": 10.0, "covered_pockets": [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35], "multiplier": 1.0 }},
        {{ "bet_type": "split", "amount": 5.0, "covered_pockets": [14, 17], "multiplier": 17.0 }}
      ]
    }}
  ],
  "conditions": [
    {{
      "id": "nl-c-1",
      "trigger": "consecutive_losses",
      "trigger_count": 2,
      "action": "double_multiplier",
      "action_value": 2,
      "reason": "Double wager after 2 consecutive losses"
    }},
    {{
      "id": "nl-c-2",
      "trigger": "max_win",
      "trigger_count": 1,
      "action": "reset_to_start",
      "action_value": 1,
      "reason": "Reset to base bet immediately on win"
    }}
  ],
  "novel_conditions": [
    {{
      "category": "action",
      "value": "custom_slug",
      "label": "Human Label",
      "description": "What it does"
    }}
  ]
}}
"""

        async with httpx.AsyncClient(timeout=18.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Parse this strategy description:\n\n{prompt}"},
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1200,
                }
            )

            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter returned {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            return json.loads(raw_content)

    @classmethod
    def _deterministic_fallback_parser(cls, prompt: str, rules: str) -> Dict[str, Any]:
        """
        High-accuracy offline domain parser extracting bets, parameters, and progression rules
        when external AI API is unavailable.
        """
        p_lower = prompt.lower()

        # Extract Bankroll
        bankroll = 1000.0
        b_match = (
            re.search(r'(?:total\s+bankroll|starting\s+bankroll|initial\s+bankroll|bankroll\s*(?:of|is|at|:|=)?)\s*\$?(\d+(?:\.\d+)?)', p_lower) or
            re.search(r'\$?(\d+(?:\.\d+)?)\s*(?:total\s+)?(?:bankroll|capital)', p_lower) or
            re.search(r'(?:starting\s+capital|initial\s+capital|total\s+capital)[:\s]*\$?(\d+(?:\.\d+)?)', p_lower) or
            re.search(r'(?:bankroll)[:\s]*\$?(\d+(?:\.\d+)?)', p_lower)
        )
        if b_match:
            bankroll = float(b_match.group(1))

        # Extract Stop Loss
        stop_loss = None
        sl_match = re.search(r'(?:stop\s*loss|stop at|loss limit|drops below|quit at -)[:\s]*\$?(\d+(?:\.\d+)?)', p_lower)
        if sl_match:
            stop_loss = float(sl_match.group(1))

        # Extract Take Profit
        target_profit = None
        tp_match = re.search(r'(?:take\s*profit|profit target|target profit|goal|exceeds|cash out at \+?)[:\s]*\$?(\d+(?:\.\d+)?)', p_lower)
        if tp_match:
            target_profit = float(tp_match.group(1))

        # Extract Spins
        spins = 100
        sp_match = re.search(r'(\d+)\s*(?:spins|rounds|spins per session)', p_lower)
        if sp_match:
            spins = int(sp_match.group(1))

        # Extract Sessions
        sessions = 10
        sess_match = re.search(r'(\d+)\s*(?:sessions|runs)', p_lower)
        if sess_match:
            sessions = int(sess_match.group(1))

        # Determine Primary Bet
        placements: List[Dict[str, Any]] = []
        base_amt = 10.0
        amt_match = (
            re.search(r'(?:start\s+with|starting\s+bet|base\s+bet|bet|wager)\s*\$?(\d+(?:\.\d+)?)\s*(?:on|units?)', p_lower) or
            re.search(r'\$?(\d+(?:\.\d+)?)\s*(?:on|bet on|units on)', p_lower) or
            re.search(r'(?:start\s+with)\s*\$?(\d+(?:\.\d+)?)', p_lower)
        )
        if amt_match:
            base_amt = float(amt_match.group(1))

        if "black" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("outside_black", rules)
            placements.append({"bet_type": "outside_black", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "red" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("outside_red", rules)
            placements.append({"bet_type": "outside_red", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "even" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("outside_even", rules)
            placements.append({"bet_type": "outside_even", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "odd" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("outside_odd", rules)
            placements.append({"bet_type": "outside_odd", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "1st dozen" in p_lower or "first dozen" in p_lower or "dozen 1" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("dozen_1", rules)
            placements.append({"bet_type": "dozen_1", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "2nd dozen" in p_lower or "second dozen" in p_lower or "dozen 2" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("dozen_2", rules)
            placements.append({"bet_type": "dozen_2", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        elif "3rd dozen" in p_lower or "third dozen" in p_lower or "dozen 3" in p_lower:
            pockets, mult = get_covered_pockets_for_bet("dozen_3", rules)
            placements.append({"bet_type": "dozen_3", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})
        else:
            pockets, mult = get_covered_pockets_for_bet("outside_red", rules)
            placements.append({"bet_type": "outside_red", "amount": base_amt, "covered_pockets": pockets, "multiplier": mult})

        # Check secondary bet (hedging, e.g. split or dozen)
        if "split" in p_lower:
            placements.append({
                "bet_type": "split",
                "amount": max(2.0, base_amt * 0.2),
                "covered_pockets": [14, 17],
                "multiplier": 17.0
            })

        # Progression Levels construction
        levels = []
        is_martingale = "martingale" in p_lower or "double" in p_lower
        is_dalembert = "d'alembert" in p_lower or "dalembert" in p_lower
        is_reverse = "reverse" in p_lower or "paroli" in p_lower

        num_lvls = 5 if (is_martingale or is_dalembert) else 1
        for i in range(1, num_lvls + 1):
            scale = 2 ** (i - 1) if is_martingale else i
            lvl_placements = [
                {
                    "bet_type": b["bet_type"],
                    "amount": round(b["amount"] * scale, 2),
                    "covered_pockets": b["covered_pockets"],
                    "multiplier": b["multiplier"]
                }
                for b in placements
            ]
            levels.append({
                "level_number": i,
                "total_wager": sum(p["amount"] for p in lvl_placements),
                "placements": lvl_placements
            })

        # Conditions construction
        conditions: List[Dict[str, Any]] = []
        novel_conditions: List[Dict[str, Any]] = []

        if is_reverse:
            conditions.append({
                "id": "c-win-step",
                "trigger": "any_win",
                "trigger_count": 1,
                "action": "increase_level",
                "action_value": 1,
                "reason": "Increase progression level on win"
            })
            conditions.append({
                "id": "c-loss-reset",
                "trigger": "any_loss",
                "trigger_count": 1,
                "action": "reset_to_start",
                "action_value": 1,
                "reason": "Reset to base bet on any loss"
            })
            conditions.append({
                "id": "c-streak-lock",
                "trigger": "consecutive_wins",
                "trigger_count": 3,
                "action": "reset_to_start",
                "action_value": 1,
                "reason": "Lock profit after 3 consecutive wins"
            })
        elif is_dalembert:
            conditions.append({
                "id": "c-loss-step",
                "trigger": "total_loss",
                "trigger_count": 1,
                "action": "increase_level",
                "action_value": 1,
                "reason": "D'Alembert: +1 level on loss"
            })
            conditions.append({
                "id": "c-win-step",
                "trigger": "any_win",
                "trigger_count": 1,
                "action": "decrease_level",
                "action_value": 1,
                "reason": "D'Alembert: -1 level on win"
            })
        else:
            # Default / Martingale pattern
            loss_cnt = 2 if ("2 losses" in p_lower or "twice" in p_lower) else 1
            action = "increase_level" if num_lvls > 1 else "double_multiplier"
            conditions.append({
                "id": "c-loss-escalate",
                "trigger": "consecutive_losses" if loss_cnt > 1 else "total_loss",
                "trigger_count": loss_cnt,
                "action": action,
                "action_value": 1 if action == "increase_level" else 2,
                "reason": f"Escalate wager on {loss_cnt} loss{'es' if loss_cnt > 1 else ''}"
            })
            conditions.append({
                "id": "c-win-reset",
                "trigger": "any_win",
                "trigger_count": 1,
                "action": "reset_to_start",
                "action_value": 1,
                "reason": "Reset to base bet on any win"
            })

        # Profit banking condition
        if target_profit:
            conditions.append({
                "id": "c-profit-bank",
                "trigger": "profit_loss",
                "trigger_count": 1,
                "comparison": "session_profit_gte",
                "threshold_amount": target_profit,
                "action": "reset_to_start",
                "action_value": 1,
                "reason": f"Lock profit target at +${target_profit:.0f}"
            })

        # Check for novel phrases in prompt
        if "drawdown" in p_lower and "exceed" in p_lower:
            novel_conditions.append({
                "category": "trigger",
                "value": "drawdown_gte",
                "label": "Drawdown Threshold ≥",
                "description": "Fires when portfolio drawdown from peak reaches monetary threshold"
            })

        strat_name = "Custom Natural Strategy"
        if is_martingale:
            strat_name = f"Martingale on {placements[0]['bet_type'].replace('outside_', '').capitalize()}"
        elif is_dalembert:
            strat_name = f"D'Alembert on {placements[0]['bet_type'].replace('outside_', '').capitalize()}"
        elif is_reverse:
            strat_name = f"Reverse Paroli System"

        return {
            "strategy_name": strat_name,
            "explanation": f"Automated strategy built from your description. Bets {base_amt} on {placements[0]['bet_type'].replace('outside_', '').capitalize()} across {len(levels)} level(s) with {len(conditions)} workflow rule(s).",
            "parameters": {
                "bankroll": bankroll,
                "total_spins": spins,
                "total_sessions": sessions,
                "stop_loss": stop_loss,
                "target_profit": target_profit,
            },
            "levels": levels,
            "conditions": conditions,
            "novel_conditions": novel_conditions,
        }

    @classmethod
    async def _persist_novel_options(
        cls,
        novel_conditions: List[Dict[str, Any]],
        db: AsyncSession
    ) -> List[CustomOptionResponse]:
        """
        Inserts novel conditions into custom_condition_options DB table if not already present.
        Returns the list of newly created options.
        """
        created = []
        for nc in novel_conditions:
            val = nc.get("value", "").strip().lower().replace(" ", "_")
            cat = nc.get("category", "trigger").strip().lower()
            lbl = nc.get("label", val.replace("_", " ").title())
            desc = nc.get("description", f"Custom community {cat}: {lbl}")

            if not val or cat not in ("trigger", "action", "comparison"):
                continue

            # Check if exists in DB
            stmt = select(CustomConditionOption).where(CustomConditionOption.value == val)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            if not existing:
                opt_id = str(uuid.uuid4())
                new_opt = CustomConditionOption(
                    id=opt_id,
                    category=cat,
                    value=val,
                    label=lbl,
                    description=desc,
                    parameters_schema=nc.get("parameters_schema"),
                    created_by="ai_natural_language",
                )
                db.add(new_opt)
                await db.commit()
                await db.refresh(new_opt)

                created.append(
                    CustomOptionResponse(
                        id=new_opt.id,
                        category=new_opt.category,
                        value=new_opt.value,
                        label=new_opt.label,
                        description=new_opt.description,
                        parameters_schema=new_opt.parameters_schema,
                        created_by=new_opt.created_by,
                        created_at=new_opt.created_at.isoformat() if new_opt.created_at else None,
                    )
                )

        return created

nl_strategy_service = NaturalLanguageStrategyService()
