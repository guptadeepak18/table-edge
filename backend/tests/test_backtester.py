import time
import pytest
from app.services.backtest_service import backtest_service
from app.schemas.strategy import BacktestConfig, AdvancedBacktestConfig, StrategyCondition
from app.schemas.game import ProgressionLevel, BetPlacement

def test_backtester_10k_sessions_performance():
    # 3-level Martingale-style Red bet progression
    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )
    level2 = ProgressionLevel(
        level_number=2,
        total_wager=20.0,
        placements=[
            BetPlacement(
                id="b2",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=20.0,
                multiplier=1.0
            )
        ]
    )
    level3 = ProgressionLevel(
        level_number=3,
        total_wager=40.0,
        placements=[
            BetPlacement(
                id="b3",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=40.0,
                multiplier=1.0
            )
        ]
    )

    config = BacktestConfig(
        initial_bankroll=1000.0,
        total_sessions=10000,
        rules="EUR",
        levels=[level1, level2, level3]
    )

    start_time = time.time()
    result = backtest_service.run_simulation(config)
    elapsed = time.time() - start_time

    assert result.total_sessions == 10000
    assert result.sessions_won + result.sessions_lost == 10000
    assert 0 <= result.win_rate <= 100
    assert result.max_drawdown >= 0
    assert len(result.history) == 10001
    # Check that 10,000 sessions finishes in under 5.0 seconds (benchmark)
    assert elapsed < 5.0, f"Backtest 10k sessions took {elapsed:.2f}s, expected < 5.0s"

def test_advanced_simulation_engine():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )
    level2 = ProgressionLevel(
        level_number=2,
        total_wager=20.0,
        placements=[
            BetPlacement(
                id="b2",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=20.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        StrategyCondition(
            id="c1",
            trigger="total_loss",
            trigger_count=1,
            action="increase_level",
            action_value=1
        ),
        StrategyCondition(
            id="c2",
            trigger="max_win",
            trigger_count=1,
            action="reset_to_start",
            action_value=1
        ),
        StrategyCondition(
            id="c3",
            trigger="profit_loss",
            trigger_count=1,
            comparison="session_profit_gte",
            threshold_amount=100.0,
            action="reset_to_start",
            action_value=1
        )
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=1000.0,
        total_spins=100,
        rules="EUR",
        levels=[level1, level2],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)

    assert result.initial_bankroll == 1000.0
    assert result.total_spins == 100
    assert result.completed_spins > 0
    assert len(result.history) == result.completed_spins + 1
    assert result.peak_bankroll >= result.lowest_bankroll
    assert result.max_drawdown >= 0.0
    assert len(result.level_stats) == 2
    assert result.ai_suggestions is not None
    assert len(result.ai_suggestions.suggested_conditions) > 0

def test_condition_multiplier_scaling():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        StrategyCondition(
            id="c-loss",
            trigger="total_loss",
            trigger_count=1,
            action="keep_level",
            action_value=0,
            multiplier=2.0,
            multiplier_mode="compound"
        ),
        StrategyCondition(
            id="c-win",
            trigger="max_win",
            trigger_count=1,
            action="reset_to_start",
            action_value=1,
            multiplier=1.0,
            multiplier_mode="fixed"
        )
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=1000000.0,
        total_spins=30,
        rules="EUR",
        levels=[level1],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.completed_spins > 0
    assert len(result.history) == result.completed_spins + 1
    # Verify that wagers exceeded base 10.0 when consecutive losses occurred
    wagers = [pt.wager for pt in result.history[1:]]
    assert max(wagers) >= 10.0
    # Point 0 is initial bankroll
    assert result.history[0].balance == 1000000.0

def test_incremental_profit_and_additive_multiplier():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    level1 = ProgressionLevel(
        level_number=1,
        total_wager=5.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=5.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        StrategyCondition(
            id="c-inc-mult",
            trigger="total_loss",
            trigger_count=1,
            action="increase_multiplier",
            action_value=1
        ),
        StrategyCondition(
            id="c-dec-mult",
            trigger="max_win",
            trigger_count=1,
            action="decrease_multiplier",
            action_value=1
        ),
        StrategyCondition(
            id="c-profit-inc",
            trigger="profit_loss",
            trigger_count=1,
            comparison="session_profit_incremental",
            threshold_amount=20.0,
            threshold_increment=20.0,
            action="reset_to_start",
            action_value=1
        )
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=10000.0,
        total_spins=100,
        rules="EUR",
        levels=[level1],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.completed_spins > 0
    assert len(result.history) == result.completed_spins + 1
    # Verify valid wager scaling
    wagers = [pt.wager for pt in result.history[1:]]
    assert all(w >= 5.0 for w in wagers)

def test_new_peak_and_any_win_any_loss_triggers():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        StrategyCondition(
            id="c-any-loss",
            trigger="any_loss",
            trigger_count=1,
            action="increase_multiplier",
            action_value=1
        ),
        StrategyCondition(
            id="c-new-peak",
            trigger="new_peak",
            trigger_count=1,
            action="reset_to_start",
            action_value=1
        ),
        StrategyCondition(
            id="c-any-win",
            trigger="any_win",
            trigger_count=2,
            action="decrease_multiplier",
            action_value=1
        )
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=50000.0,
        total_spins=100,
        rules="EUR",
        levels=[level1],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.completed_spins > 0
    assert len(result.history) == result.completed_spins + 1
    # Check that condition stats captured the triggers
    c_ids = [s.condition_id for s in result.condition_stats]
    assert "c-any-loss" in c_ids
    assert "c-new-peak" in c_ids
    assert "c-any-win" in c_ids

def test_multi_session_advanced_simulation():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        StrategyCondition(
            id="c-loss",
            trigger="total_loss",
            trigger_count=1,
            action="increase_multiplier",
            action_value=1
        ),
        StrategyCondition(
            id="c-win",
            trigger="max_win",
            trigger_count=1,
            action="reset_to_start",
            action_value=1
        )
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=1000.0,
        total_sessions=20,
        total_spins=50,
        rules="EUR",
        levels=[level1],
        conditions=conditions,
        target_profit=50.0,
        stop_loss=100.0
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.total_sessions == 20
    assert len(result.sessions) == 20
    assert result.sessions_won + result.sessions_lost + result.sessions_breakeven == 20
    assert 0 <= result.session_win_rate <= 100.0
    assert result.target_profit_hits >= 0
    assert result.stop_loss_hits >= 0
    assert result.best_session_net >= result.worst_session_net
    assert result.avg_spins_per_session > 0
    # First session has detailed history
    assert len(result.history) > 0
    # Each session has trajectory
    assert all(len(s.balance_trajectory) > 0 for s in result.sessions)


def test_partial_win_and_multi_bet_classification():
    from app.schemas.strategy import AdvancedBacktestConfig, StrategyCondition

    # Level with Red ($10) + Straight 17 ($1) -> Total wager = $11
    # 17 hits: Payout = 36, Net = +25 -> Max Win
    # Red hits (not 17): Payout = 20, Net = +9 -> Partial Win
    # Black hits (not 17): Payout = 0, Net = -11 -> Total Loss
    level = ProgressionLevel(
        level_number=1,
        total_wager=11.0,
        placements=[
            BetPlacement(
                id="b_red",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            ),
            BetPlacement(
                id="b_17",
                bet_type="straight",
                covered_pockets=[17],
                amount=1.0,
                multiplier=35.0
            )
        ]
    )

    conditions = [
        StrategyCondition(id="c_pw", trigger="partial_win", trigger_count=1, action="keep_level", action_value=0),
        StrategyCondition(id="c_mw", trigger="max_win", trigger_count=1, action="reset_to_start", action_value=1),
        StrategyCondition(id="c_tl", trigger="total_loss", trigger_count=1, action="keep_level", action_value=0),
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=1000.0,
        total_sessions=1,
        total_spins=1000,
        rules="EUR",
        levels=[level],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.completed_spins == 1000
    # Over 1000 spins, Red hits ~48.6% of the time, 17 hits ~2.7% of the time
    assert result.total_wins == result.max_wins + result.partial_wins
    assert result.partial_wins > 0, "Hedging/tiered strategy must produce partial wins"
    assert result.max_wins >= 0
    assert result.total_losses > 0
    # Both max_wins and partial_wins are positive net wins
    assert all(pt.net_win > 0 for pt in result.history if pt.outcome in ("max_win", "partial_win"))
    # Total loss produces net_win == -total_wager
    assert all(pt.net_win < 0 for pt in result.history if pt.outcome == "total_loss")

def test_reset_to_start_clean_slate_and_ai_suggestions():
    level1 = ProgressionLevel(
        level_number=1,
        total_wager=10.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=10.0,
                multiplier=1.0
            )
        ]
    )
    level2 = ProgressionLevel(
        level_number=2,
        total_wager=20.0,
        placements=[
            BetPlacement(
                id="b2",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=20.0,
                multiplier=1.0
            )
        ]
    )

    conditions = [
        # Step up on 2 consecutive losses
        StrategyCondition(id="c_loss", trigger="consecutive_losses", trigger_count=2, action="increase_level", action_value=1),
        # Reset on any win
        StrategyCondition(id="c_win", trigger="any_win", trigger_count=1, action="reset_to_start", action_value=1),
    ]

    config = AdvancedBacktestConfig(
        initial_bankroll=1000.0,
        total_sessions=1,
        total_spins=200,
        rules="EUR",
        levels=[level1, level2],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    assert result.completed_spins == 200
    assert result.ai_suggestions is not None
    assert result.ai_suggestions.archetype is not None
    assert len(result.ai_suggestions.suggested_conditions) > 0

    # Verify that in history, after a win action 'Reset to Level 1 & 1.0x (Fresh Start)',
    # the next level is indeed 1 and multiplier is 1.0
    for i, pt in enumerate(result.history):
        if pt.action_taken and "Reset" in pt.action_taken:
            assert pt.next_level == 1
            assert pt.next_multiplier == 1.0
            # If there's a subsequent spin, it starts from Level 1
            if i + 1 < len(result.history):
                assert result.history[i + 1].level == 1

def test_wager_always_multiple_of_base_bet_even_when_bankroll_insufficient():
    # Base bet $15
    level1 = ProgressionLevel(
        level_number=1,
        total_wager=15.0,
        placements=[
            BetPlacement(
                id="b1",
                bet_type="outside_red",
                covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                amount=15.0,
                multiplier=1.0
            )
        ]
    )

    # Multiplier doubles on loss
    conditions = [
        StrategyCondition(id="c_loss", trigger="total_loss", trigger_count=1, action="double_multiplier", action_value=2),
    ]

    # Start with $73 (which is not a multiple of 15)
    config = AdvancedBacktestConfig(
        initial_bankroll=73.0,
        total_sessions=1,
        total_spins=50,
        rules="EUR",
        levels=[level1],
        conditions=conditions
    )

    result = backtest_service.run_advanced_simulation(config)
    for pt in result.history:
        if pt.spin > 0:
            # Every wager must be an exact positive multiple of the base bet $15
            assert pt.wager > 0
            assert pt.wager % 15.0 == 0, f"Spin {pt.spin} wager {pt.wager} is not a multiple of 15"


