from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.simulator import Strategy, StrategyLevel, BetPlacementModel
from app.schemas.strategy import StrategyCreate, StrategyResponse
from app.schemas.game import ProgressionLevel, BetPlacement

router = APIRouter(prefix="/strategies", tags=["strategies"])

@router.post("", response_model=StrategyResponse)
async def create_strategy(data: StrategyCreate, db: AsyncSession = Depends(get_db)):
    strategy = Strategy(
        name=data.name,
        rules=data.rules,
    )
    db.add(strategy)
    await db.flush()

    for idx, lvl in enumerate(data.levels):
        lvl_num = lvl.level_number if lvl.level_number > 0 else (idx + 1)
        db_lvl = StrategyLevel(
            strategy_id=strategy.id,
            level_number=lvl_num,
            total_wager=lvl.total_wager,
        )
        db.add(db_lvl)
        await db.flush()

        for bet in lvl.placements:
            db_bet = BetPlacementModel(
                strategy_level_id=db_lvl.id,
                bet_type=bet.bet_type,
                covered_pockets=bet.covered_pockets,
                amount=bet.amount,
                multiplier=bet.multiplier,
            )
            db.add(db_bet)

    await db.commit()
    await db.refresh(strategy)

    return StrategyResponse(
        id=strategy.id,
        user_id=strategy.user_id,
        name=strategy.name,
        rules=strategy.rules,
        levels=data.levels,
        created_at=strategy.created_at.isoformat(),
        updated_at=strategy.updated_at.isoformat(),
    )

@router.get("", response_model=List[StrategyResponse])
async def list_strategies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).order_by(Strategy.updated_at.desc()))
    strategies = result.scalars().all()
    out = []
    for s in strategies:
        # Fetch levels
        lvl_res = await db.execute(
            select(StrategyLevel).where(StrategyLevel.strategy_id == s.id).order_by(StrategyLevel.level_number.asc())
        )
        levels_db = lvl_res.scalars().all()
        levels_out = []
        for l in levels_db:
            bet_res = await db.execute(
                select(BetPlacementModel).where(BetPlacementModel.strategy_level_id == l.id)
            )
            bets_db = bet_res.scalars().all()
            placements = [
                BetPlacement(
                    id=b.id,
                    bet_type=b.bet_type,
                    covered_pockets=b.covered_pockets,
                    amount=b.amount,
                    multiplier=b.multiplier,
                )
                for b in bets_db
            ]
            levels_out.append(ProgressionLevel(
                level_number=l.level_number,
                total_wager=l.total_wager,
                placements=placements,
            ))
        out.append(StrategyResponse(
            id=s.id,
            user_id=s.user_id,
            name=s.name,
            rules=s.rules,
            levels=levels_out,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        ))
    return out

@router.put("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(strategy_id: str, data: StrategyCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    strategy.name = data.name
    strategy.rules = data.rules
    strategy.updated_at = datetime.now(timezone.utc)

    # Explicitly delete all placements and levels for this strategy
    lvl_res = await db.execute(select(StrategyLevel.id).where(StrategyLevel.strategy_id == strategy.id))
    level_ids = lvl_res.scalars().all()
    if level_ids:
        await db.execute(delete(BetPlacementModel).where(BetPlacementModel.strategy_level_id.in_(level_ids)))
        await db.execute(delete(StrategyLevel).where(StrategyLevel.strategy_id == strategy.id))
    await db.flush()

    # Recreate levels & placements with clean, normalized level numbers
    clean_levels: List[ProgressionLevel] = []
    for idx, lvl in enumerate(data.levels):
        lvl_num = idx + 1
        db_lvl = StrategyLevel(
            strategy_id=strategy.id,
            level_number=lvl_num,
            total_wager=lvl.total_wager,
        )
        db.add(db_lvl)
        await db.flush()

        saved_placements = []
        for bet in lvl.placements:
            db_bet = BetPlacementModel(
                strategy_level_id=db_lvl.id,
                bet_type=bet.bet_type,
                covered_pockets=bet.covered_pockets,
                amount=bet.amount,
                multiplier=bet.multiplier,
            )
            db.add(db_bet)
            saved_placements.append(bet)

        clean_levels.append(ProgressionLevel(
            level_number=lvl_num,
            total_wager=lvl.total_wager,
            placements=saved_placements,
        ))

    await db.commit()
    await db.refresh(strategy)

    return StrategyResponse(
        id=strategy.id,
        user_id=strategy.user_id,
        name=strategy.name,
        rules=strategy.rules,
        levels=clean_levels,
        created_at=strategy.created_at.isoformat(),
        updated_at=strategy.updated_at.isoformat(),
    )

@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # Explicitly delete placements and levels first
    lvl_res = await db.execute(select(StrategyLevel.id).where(StrategyLevel.strategy_id == strategy.id))
    level_ids = lvl_res.scalars().all()
    if level_ids:
        await db.execute(delete(BetPlacementModel).where(BetPlacementModel.strategy_level_id.in_(level_ids)))
        await db.execute(delete(StrategyLevel).where(StrategyLevel.strategy_id == strategy.id))

    await db.delete(strategy)
    await db.commit()
    return {"status": "ok", "deleted_id": strategy_id}
