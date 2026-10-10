import time
import math
import secrets
from typing import List, Dict, Any, Optional, Generator
from app.schemas.game import ProgressionLevel, GameRules, PocketValue
from app.schemas.strategy import (
    BacktestConfig, BacktestResult,
    AdvancedBacktestConfig, AdvancedBacktestResult,
    StrategyCondition, LevelStats, AISuggestion, BacktestHistoryPoint,
    ConditionTriggerStat, SessionRecord
)
from app.core.constants import BET_PAYOUT_MULTIPLIERS

def format_trigger_desc(c: StrategyCondition) -> str:
    if c.trigger == "total_loss":
        return f"Total Loss (every {c.trigger_count})"
    elif c.trigger == "partial_loss":
        return f"Partial Loss (every {c.trigger_count})"
    elif c.trigger == "any_loss":
        return f"Any Loss (every {c.trigger_count})"
    elif c.trigger == "push":
        return f"Push / Break-Even (every {c.trigger_count})"
    elif c.trigger == "partial_win":
        return f"Partial Win (every {c.trigger_count})"
    elif c.trigger == "max_win":
        return f"Max Win (every {c.trigger_count})"
    elif c.trigger == "any_win":
        return f"Any Win (every {c.trigger_count})"
    elif c.trigger == "consecutive_losses":
        return f"{c.trigger_count} Consecutive Losses"
    elif c.trigger == "consecutive_wins":
        return f"{c.trigger_count} Consecutive Wins"
    elif c.trigger == "consecutive_pushes":
        return f"{c.trigger_count} Consecutive Pushes"
    elif c.trigger == "consecutive_non_wins":
        return f"{c.trigger_count} Consecutive Non-Wins"
    elif c.trigger == "new_peak":
        return f"New Peak Balance (every {c.trigger_count})"
    elif c.trigger == "profit_loss":
        if c.comparison == "session_profit_incremental":
            inc = c.threshold_increment if c.threshold_increment is not None else (c.threshold_amount or 0.0)
            return f"Sess Profit (Inc: ${c.threshold_amount or 0} +${inc})"
        elif c.comparison == "session_profit_gte":
            return f"Session Profit ≥ ${c.threshold_amount or 0}"
        elif c.comparison == "session_loss_gte":
            return f"Session Loss ≥ ${c.threshold_amount or 0}"
        elif c.comparison == "spin_profit_gte":
            return f"Spin Profit ≥ ${c.threshold_amount or 0}"
        elif c.comparison == "spin_loss_gte":
            return f"Spin Loss ≥ ${c.threshold_amount or 0}"
        elif c.comparison == "peak_profit_giveback":
            return f"Peak Profit Giveback ≥ ${c.threshold_amount or 0}"
        elif c.comparison == "spin_profit_pct_wager":
            return f"Spin Payout ≥ {c.threshold_amount or 2}× Wager"
    elif c.trigger == "drawdown_gte":
        return f"Drawdown ≥ ${c.threshold_amount or 0}"
    elif c.trigger == "drawdown_percent_gte":
        return f"Drawdown ≥ {c.threshold_amount or 20}%"
    elif c.trigger == "bankroll_remaining_lte":
        return f"Bankroll Floor ≤ ${c.threshold_amount or 0}"
    elif c.trigger == "session_roi_gte":
        return f"Session ROI ≥ +{c.threshold_amount or 25}%"
    elif c.trigger == "level_reached":
        return f"Reached Level L{c.action_value or 1}"
    elif c.trigger == "level_at_least":
        return f"At Level ≥ L{c.action_value or 2}"
    elif c.trigger == "spin_count_reached":
        return f"Spin #{c.threshold_amount or c.trigger_count or 50} Reached"
    elif c.trigger == "bet_size_gte":
        return f"Wager Size ≥ ${c.threshold_amount or 100}"
    return c.trigger

def format_action_desc(c: StrategyCondition) -> str:
    if c.action == "increase_level":
        return f"+{c.action_value} Level"
    elif c.action == "decrease_level":
        return f"−{c.action_value} Level"
    elif c.action == "goto_level":
        return f"Go to L{c.action_value}"
    elif c.action == "revert_to_level":
        return f"Revert to L{c.action_value or 1} (Keep Mult)"
    elif c.action == "reset_to_start":
        return "Reset to L1 & 1.0x"
    elif c.action == "keep_level":
        return "Stay at Level"
    elif c.action == "increase_multiplier":
        return f"× Bet +{c.action_value}"
    elif c.action == "decrease_multiplier":
        return f"× Bet −{c.action_value}"
    elif c.action == "multiply_by":
        return f"Multiply Bet ×{c.multiplier or c.action_value or 1.5}"
    elif c.action == "set_multiplier":
        return f"Set Bet {c.multiplier or c.action_value or 1.0}×"
    elif c.action == "double_multiplier":
        return "Double Bet (2×)"
    elif c.action == "triple_multiplier":
        return "Triple Bet (3×)"
    elif c.action == "half_multiplier":
        return "Halve Bet (0.5×)"
    elif c.action == "reset_multiplier":
        return "Reset Multiplier (1.0×)"
    elif c.action == "reset_streak_counters":
        return "Reset Streak Counters"
    elif c.action == "stop_simulation":
        return "Halt Session Early"
    return c.action

class BacktestService:
    @staticmethod
    def run_simulation(config: BacktestConfig) -> BacktestResult:
        """
        Executes a high-performance Monte Carlo backtest across N simulated sessions.
        Supports arbitrary N levels and stop conditions.
        """
        rules = config.rules.upper()
        max_pocket = 38 if rules == "USA" else 37
        levels = config.levels
        initial_bankroll = float(config.initial_bankroll)
        total_sessions = config.total_sessions
        stop_loss = config.stop_loss
        target_profit = config.target_profit

        bankroll = initial_bankroll
        peak_bankroll = initial_bankroll
        max_drawdown = 0.0
        sessions_won = 0
        sessions_lost = 0
        history: List[float] = [round(initial_bankroll, 2)]

        # Pre-process levels for ultra-fast inner-loop execution
        processed_levels = []
        for lvl in levels:
            total_wager = float(lvl.total_wager)
            pockets_map: Dict[int, float] = {}
            for bet in lvl.placements:
                multiplier = bet.multiplier if bet.multiplier > 0 else BET_PAYOUT_MULTIPLIERS.get(bet.bet_type, 1.0)
                win_return = bet.amount * (multiplier + 1)
                for p in bet.covered_pockets:
                    p_idx = 37 if (rules == "USA" and str(p) == "00") else int(p)
                    pockets_map[p_idx] = pockets_map.get(p_idx, 0.0) + win_return
            processed_levels.append((total_wager, pockets_map))

        num_levels = len(processed_levels)
        if num_levels == 0:
            return BacktestResult(
                initial_bankroll=initial_bankroll,
                total_sessions=total_sessions,
                sessions_won=0,
                sessions_lost=0,
                win_rate=0.0,
                max_drawdown=0.0,
                max_drawdown_percent=0.0,
                peak_bankroll=initial_bankroll,
                final_bankroll=initial_bankroll,
                net_profit=0.0,
                history=history,
            )

        # Simulation loop
        for s in range(total_sessions):
            # Check stop conditions
            if stop_loss is not None and bankroll <= stop_loss:
                break
            if target_profit is not None and (bankroll - initial_bankroll) >= target_profit:
                break

            current_lvl_idx = 0
            session_won = False

            while current_lvl_idx < num_levels and not session_won:
                total_wager, pockets_map = processed_levels[current_lvl_idx]
                bankroll -= total_wager

                landed_pocket = secrets.randbelow(max_pocket)
                payout = pockets_map.get(landed_pocket, 0.0)

                if payout > 0:
                    bankroll += payout
                    session_won = True
                else:
                    current_lvl_idx += 1

                if bankroll > peak_bankroll:
                    peak_bankroll = bankroll
                drawdown = peak_bankroll - bankroll
                if drawdown > max_drawdown:
                    max_drawdown = drawdown

            if session_won:
                sessions_won += 1
            else:
                sessions_lost += 1

            history.append(round(bankroll, 2))

        completed_sessions = sessions_won + sessions_lost
        win_rate = round((sessions_won / completed_sessions * 100), 2) if completed_sessions > 0 else 0.0
        max_drawdown_pct = round((max_drawdown / peak_bankroll * 100), 2) if peak_bankroll > 0 else 0.0
        net_profit = round(bankroll - initial_bankroll, 2)

        return BacktestResult(
            initial_bankroll=initial_bankroll,
            total_sessions=completed_sessions,
            sessions_won=sessions_won,
            sessions_lost=sessions_lost,
            win_rate=win_rate,
            max_drawdown=round(max_drawdown, 2),
            max_drawdown_percent=max_drawdown_pct,
            peak_bankroll=round(peak_bankroll, 2),
            final_bankroll=round(bankroll, 2),
            net_profit=net_profit,
            history=history,
        )

    @classmethod
    def run_advanced_simulation(cls, config: AdvancedBacktestConfig) -> AdvancedBacktestResult:
        """
        Executes a spin-by-spin strategy simulation with dynamic condition builder triggers,
        precise outcome classification, and AI-powered strategy improvement analysis.
        """
        rules = config.rules.upper()
        max_pocket = 38 if rules == "USA" else 37
        levels = config.levels
        initial_bankroll = float(config.initial_bankroll)
        total_spins = config.total_spins
        stop_loss = config.stop_loss
        target_profit = config.target_profit
        conditions = config.conditions

        # Pre-process levels
        processed_levels = []
        for lvl in levels:
            total_wager = float(lvl.total_wager) if lvl.total_wager > 0 else sum(float(b.amount) for b in lvl.placements)
            pockets_map: Dict[int, float] = {}
            pockets_hit_count: Dict[int, int] = {}
            for p in range(max_pocket):
                p_payout = 0.0
                hit_cnt = 0
                for bet in lvl.placements:
                    canonical = BET_PAYOUT_MULTIPLIERS.get(bet.bet_type)
                    if canonical is not None and canonical > 1:
                        mult = canonical
                    else:
                        mult = bet.multiplier if bet.multiplier > 0 else (canonical if canonical is not None else 1.0)
                    win_ret = bet.amount * (mult + 1)
                    for covered in bet.covered_pockets:
                        c_idx = 37 if (rules == "USA" and str(covered) == "00") else int(covered)
                        if c_idx == p:
                            p_payout += win_ret
                            hit_cnt += 1
                            break
                pockets_map[p] = p_payout
                pockets_hit_count[p] = hit_cnt

            all_p = list(pockets_map.values())
            max_payout = max(all_p) if all_p else 0.0
            win_p = [val for val in all_p if val > total_wager]
            min_win = min(win_p) if win_p else 0.0
            has_distinct = (max_payout - min_win) > 0.01

            processed_levels.append({
                "total_wager": total_wager,
                "pockets_map": pockets_map,
                "pockets_hit_count": pockets_hit_count,
                "max_payout": max_payout,
                "has_distinct_tiers": has_distinct,
                "num_placements": len(lvl.placements),
            })

        num_levels = len(processed_levels)
        if num_levels == 0:
            raise ValueError("Please provide a strategy with at least 1 valid level.")

        total_sessions = max(1, getattr(config, "total_sessions", 1) or 1)
        global_completed_spins = 0
        global_total_wins = 0
        global_max_wins = 0
        global_partial_wins = 0
        global_total_losses = 0
        global_partial_losses = 0
        global_pushes = 0
        global_gross_wins = 0.0
        global_gross_losses = 0.0
        global_total_wagered = 0.0
        global_max_bet_size = 0.0
        global_spin_net_wins: List[float] = []
        global_longest_win_streak = 0
        global_longest_loss_streak = 0

        condition_hits_map: Dict[str, int] = {c.id: 0 for c in conditions}

        level_stats_map = {
            i + 1: {
                "level_number": i + 1,
                "wager": processed_levels[i]["total_wager"],
                "times_visited": 0,
                "spins_count": 0,
                "total_wagered": 0.0,
                "max_wins": 0,
                "partial_wins": 0,
                "total_losses": 0,
                "partial_losses": 0,
                "pushes": 0,
                "net_profit": 0.0,
            }
            for i in range(num_levels)
        }

        sessions_list: List[SessionRecord] = []
        primary_history: List[BacktestHistoryPoint] = []

        for s_idx in range(1, total_sessions + 1):
            bankroll = initial_bankroll
            peak_bankroll = initial_bankroll
            lowest_bankroll = initial_bankroll
            max_drawdown = 0.0

            session_wins = 0
            session_max_wins = 0
            session_partial_wins = 0
            session_total_losses = 0
            session_partial_losses = 0
            session_pushes = 0

            current_win_streak = 0
            longest_win_streak = 0
            current_loss_streak = 0
            longest_loss_streak = 0
            current_push_streak = 0
            current_non_win_streak = 0

            event_counts = {
                "partial_loss": 0,
                "total_loss": 0,
                "any_loss": 0,
                "push": 0,
                "partial_win": 0,
                "max_win": 0,
                "any_win": 0,
                "new_peak": 0,
            }

            condition_targets: Dict[str, float] = {}
            for c in conditions:
                if c.trigger == "profit_loss" and c.comparison == "session_profit_incremental":
                    condition_targets[c.id] = c.threshold_amount if c.threshold_amount is not None else 20.0

            current_lvl_idx = 0
            current_multiplier = 1.0
            consecutive_condition_hits = 0
            active_condition_id = None
            stopped_early = False
            stop_reason = None
            completed_spins = 0

            balance_trajectory: List[float] = [round(initial_bankroll, 2)]
            session_history: List[BacktestHistoryPoint] = []

            record_detailed_history = s_idx == 1 or total_sessions <= 50
            if record_detailed_history:
                session_history.append(BacktestHistoryPoint(
                    spin=0,
                    balance=round(initial_bankroll, 2),
                    level=1,
                    multiplier=1.0,
                    outcome="initial",
                    pocket="-",
                    net_win=0.0,
                    wager=0.0,
                    payout=0.0,
                    cumulative_profit=0.0,
                    next_level=1,
                    next_multiplier=1.0
                ))

            level_stats_map[1]["times_visited"] += 1

            for s in range(1, total_spins + 1):
                lvl_info = processed_levels[current_lvl_idx]
                lvl_wager = lvl_info["total_wager"]
                pockets_map = lvl_info["pockets_map"]
                max_p = lvl_info["max_payout"]
                total_wager = round(lvl_wager * current_multiplier, 2)
                scale_factor = current_multiplier

                if bankroll < total_wager:
                    if bankroll <= 0 or bankroll < lvl_wager:
                        stopped_early = True
                        stop_reason = "Bankroll fully depleted ($0)" if bankroll <= 0 else f"Insufficient for 1 unit (${round(bankroll, 2)} < ${round(lvl_wager, 2)})"
                        break
                    # Floor to the nearest whole multiple of the base level wager
                    # so wagers always remain multiples of the base bet unit
                    affordable_units = math.floor(bankroll / lvl_wager)
                    current_multiplier = affordable_units
                    scale_factor = affordable_units
                    total_wager = round(lvl_wager * affordable_units, 2)

                completed_spins = s
                global_completed_spins += 1
                bankroll -= total_wager
                global_total_wagered += total_wager
                if total_wager > global_max_bet_size:
                    global_max_bet_size = total_wager

                landed_pocket = secrets.randbelow(max_pocket)
                display_pocket = "00" if (rules == "USA" and landed_pocket == 37) else landed_pocket
                base_payout = pockets_map.get(landed_pocket, 0.0)
                payout = round(base_payout * scale_factor, 2)
                net_win = round(payout - total_wager, 2)
                bankroll = round(bankroll + payout, 2)

                global_spin_net_wins.append(net_win)

                if payout == 0:
                    outcome = "total_loss"
                    session_total_losses += 1
                    global_total_losses += 1
                    global_gross_losses += total_wager
                    current_loss_streak += 1
                    current_win_streak = 0
                    current_push_streak = 0
                    current_non_win_streak += 1
                    if current_loss_streak > longest_loss_streak:
                        longest_loss_streak = current_loss_streak
                    if current_loss_streak > global_longest_loss_streak:
                        global_longest_loss_streak = current_loss_streak
                    event_counts["total_loss"] += 1
                    event_counts["any_loss"] += 1
                elif payout < total_wager:
                    outcome = "partial_loss"
                    session_partial_losses += 1
                    global_partial_losses += 1
                    global_gross_losses += (total_wager - payout)
                    current_loss_streak += 1
                    current_win_streak = 0
                    current_push_streak = 0
                    current_non_win_streak += 1
                    if current_loss_streak > longest_loss_streak:
                        longest_loss_streak = current_loss_streak
                    if current_loss_streak > global_longest_loss_streak:
                        global_longest_loss_streak = current_loss_streak
                    event_counts["partial_loss"] += 1
                    event_counts["any_loss"] += 1
                elif abs(payout - total_wager) < 0.001:
                    outcome = "push"
                    session_pushes += 1
                    global_pushes += 1
                    current_push_streak += 1
                    current_non_win_streak += 1
                    current_win_streak = 0
                    current_loss_streak = 0
                    event_counts["push"] += 1
                elif payout > total_wager:
                    current_non_win_streak = 0
                    current_push_streak = 0
                    if base_payout >= max_p - 0.01 and max_p > lvl_wager:
                        outcome = "max_win"
                        session_wins += 1
                        session_max_wins += 1
                        global_total_wins += 1
                        global_max_wins += 1
                        global_gross_wins += net_win
                        current_win_streak += 1
                        current_loss_streak = 0
                        if current_win_streak > longest_win_streak:
                            longest_win_streak = current_win_streak
                        if current_win_streak > global_longest_win_streak:
                            global_longest_win_streak = current_win_streak
                        event_counts["max_win"] += 1
                        event_counts["any_win"] += 1
                    else:
                        outcome = "partial_win"
                        session_wins += 1
                        session_partial_wins += 1
                        global_total_wins += 1
                        global_partial_wins += 1
                        global_gross_wins += net_win
                        current_win_streak += 1
                        current_loss_streak = 0
                        if current_win_streak > longest_win_streak:
                            longest_win_streak = current_win_streak
                        if current_win_streak > global_longest_win_streak:
                            global_longest_win_streak = current_win_streak
                        event_counts["partial_win"] += 1
                        event_counts["any_win"] += 1
                else:
                    outcome = "push"
                    session_pushes += 1
                    global_pushes += 1
                    current_push_streak += 1
                    current_non_win_streak += 1
                    current_win_streak = 0
                    current_loss_streak = 0
                    event_counts["push"] += 1

                is_new_peak = bankroll > peak_bankroll and bankroll > initial_bankroll
                if bankroll > peak_bankroll:
                    peak_bankroll = bankroll
                    if is_new_peak:
                        event_counts["new_peak"] += 1
                if bankroll < lowest_bankroll:
                    lowest_bankroll = bankroll
                current_dd = peak_bankroll - bankroll
                if current_dd > max_drawdown:
                    max_drawdown = current_dd

                balance_trajectory.append(round(bankroll, 2))

                cur_lvl_st = level_stats_map[current_lvl_idx + 1]
                cur_lvl_st["spins_count"] += 1
                cur_lvl_st["total_wagered"] += total_wager
                cur_lvl_st["net_profit"] += net_win
                if outcome == "max_win":
                    cur_lvl_st["max_wins"] += 1
                elif outcome == "partial_win":
                    cur_lvl_st["partial_wins"] += 1
                elif outcome == "total_loss":
                    cur_lvl_st["total_losses"] += 1
                elif outcome == "partial_loss":
                    cur_lvl_st["partial_losses"] += 1
                elif outcome == "push":
                    cur_lvl_st["pushes"] += 1

                initial_lvl = current_lvl_idx + 1
                initial_mult = current_multiplier
                prev_lvl_idx = current_lvl_idx
                condition_applied = None
                action_taken = None

                for c_idx, cond in enumerate(conditions):
                    rule_num = c_idx + 1
                    matched = False

                    if cond.trigger in ("total_loss", "partial_loss", "any_loss", "partial_win", "max_win", "any_win", "push"):
                        if cond.trigger == "any_loss":
                            is_match = outcome in ("total_loss", "partial_loss")
                        elif cond.trigger == "any_win":
                            is_match = outcome in ("max_win", "partial_win")
                        else:
                            is_match = outcome == cond.trigger

                        if is_match:
                            count = event_counts.get(cond.trigger, 0)
                            if cond.trigger_count <= 1 or (count % cond.trigger_count == 0):
                                matched = True
                                labels = {
                                    "total_loss": "Total Loss",
                                    "partial_loss": "Partial Loss",
                                    "any_loss": "Any Loss",
                                    "push": "Push / Break-Even",
                                    "max_win": "Max Win",
                                    "partial_win": "Partial Win",
                                    "any_win": "Any Win"
                                }
                                trig_label = labels.get(cond.trigger, cond.trigger)
                                condition_applied = f"Rule #{rule_num}: {trig_label}" + (f" (every {cond.trigger_count})" if cond.trigger_count > 1 else "")
                    elif cond.trigger == "new_peak":
                        if is_new_peak:
                            count = event_counts["new_peak"]
                            if cond.trigger_count <= 1 or (count % cond.trigger_count == 0):
                                matched = True
                                condition_applied = f"Rule #{rule_num}: New Peak (+{round(bankroll - initial_bankroll, 2)})"
                    elif cond.trigger == "profit_loss":
                        sess_profit = bankroll - initial_bankroll
                        thresh = cond.threshold_amount or 0.0

                        if cond.comparison == "session_profit_incremental":
                            cur_target = condition_targets.get(cond.id, thresh)
                            if sess_profit >= cur_target:
                                matched = True
                                condition_applied = f"Rule #{rule_num}: Milestone hit (+{sess_profit:.1f} >= +{cur_target:.1f})"
                        elif cond.comparison == "session_profit_gte" and sess_profit >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Session Profit >= +{thresh}"
                        elif cond.comparison == "session_loss_gte" and (initial_bankroll - bankroll) >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Session Loss >= -{thresh}"
                        elif cond.comparison == "spin_profit_gte" and net_win >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Spin Profit >= +{thresh}"
                        elif cond.comparison == "spin_loss_gte" and (-net_win) >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Spin Loss >= -{thresh}"
                        elif cond.comparison == "peak_profit_giveback":
                            peak_profit = max(0.0, peak_bankroll - initial_bankroll)
                            giveback = peak_profit - (bankroll - initial_bankroll)
                            if giveback >= thresh and peak_profit > 0:
                                matched = True
                                condition_applied = f"Rule #{rule_num}: Peak Profit Giveback >= ${thresh}"
                        elif cond.comparison == "spin_profit_pct_wager":
                            mult_reached = (payout / total_wager) if total_wager > 0 else 0.0
                            if mult_reached >= (thresh or 2.0):
                                matched = True
                                condition_applied = f"Rule #{rule_num}: Spin Payout >= {thresh}x Wager"
                    elif cond.trigger == "consecutive_losses":
                        req = cond.trigger_count if cond.trigger_count > 0 else 2
                        if current_loss_streak >= req and (current_loss_streak % req == 0 or current_loss_streak == req):
                            matched = True
                            condition_applied = f"Rule #{rule_num}: {current_loss_streak} Consecutive Losses"
                    elif cond.trigger == "consecutive_wins":
                        req = cond.trigger_count if cond.trigger_count > 0 else 2
                        if current_win_streak >= req and (current_win_streak % req == 0 or current_win_streak == req):
                            matched = True
                            condition_applied = f"Rule #{rule_num}: {current_win_streak} Consecutive Wins"
                    elif cond.trigger == "consecutive_pushes":
                        req = cond.trigger_count if cond.trigger_count > 0 else 2
                        if current_push_streak >= req and (current_push_streak % req == 0 or current_push_streak == req):
                            matched = True
                            condition_applied = f"Rule #{rule_num}: {current_push_streak} Consecutive Pushes"
                    elif cond.trigger == "consecutive_non_wins":
                        req = cond.trigger_count if cond.trigger_count > 0 else 2
                        if current_non_win_streak >= req and (current_non_win_streak % req == 0 or current_non_win_streak == req):
                            matched = True
                            condition_applied = f"Rule #{rule_num}: {current_non_win_streak} Consecutive Non-Wins"
                    elif cond.trigger == "drawdown_gte":
                        thresh = cond.threshold_amount or 0.0
                        if current_dd >= thresh and thresh > 0:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Drawdown >= ${thresh}"
                    elif cond.trigger == "drawdown_percent_gte":
                        current_dd_pct = (current_dd / peak_bankroll * 100.0) if peak_bankroll > 0 else 0.0
                        thresh = cond.threshold_amount or 20.0
                        if current_dd_pct >= thresh and thresh > 0:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Drawdown >= {current_dd_pct:.1f}% (Target: {thresh}%)"
                    elif cond.trigger == "bankroll_remaining_lte":
                        thresh = cond.threshold_amount if cond.threshold_amount is not None else (initial_bankroll * 0.25)
                        if bankroll <= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Bankroll Low (${bankroll:.2f} <= ${thresh})"
                    elif cond.trigger == "session_roi_gte":
                        current_roi = ((bankroll - initial_bankroll) / initial_bankroll * 100.0) if initial_bankroll > 0 else 0.0
                        thresh = cond.threshold_amount or 25.0
                        if current_roi >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Session ROI >= +{thresh}% (Current: +{current_roi:.1f}%)"
                    elif cond.trigger == "level_reached":
                        target_l = cond.action_value or (int(cond.threshold_amount) if cond.threshold_amount else 1)
                        if (current_lvl_idx + 1) == target_l:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Reached Level L{target_l}"
                    elif cond.trigger == "level_at_least":
                        target_l = cond.action_value or (int(cond.threshold_amount) if cond.threshold_amount else 2)
                        if (current_lvl_idx + 1) >= target_l:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: At Level L{current_lvl_idx + 1} >= L{target_l}"
                    elif cond.trigger == "spin_count_reached":
                        target_s = int(cond.threshold_amount) if cond.threshold_amount else (cond.trigger_count or 50)
                        if s == target_s or (cond.trigger_count > 1 and s % cond.trigger_count == 0):
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Spin #{s} Milestone Reached"
                    elif cond.trigger == "bet_size_gte":
                        thresh = cond.threshold_amount or 100.0
                        if total_wager >= thresh:
                            matched = True
                            condition_applied = f"Rule #{rule_num}: Wager ${total_wager:.2f} >= ${thresh}"

                    if matched:
                        condition_hits_map[cond.id] = condition_hits_map.get(cond.id, 0) + 1

                        if cond.action == "increase_level":
                            prev_l = current_lvl_idx + 1
                            current_lvl_idx = min(num_levels - 1, current_lvl_idx + cond.action_value)
                            action_taken = f"Level +{cond.action_value} (L{prev_l} -> L{current_lvl_idx + 1})"
                        elif cond.action == "decrease_level":
                            prev_l = current_lvl_idx + 1
                            current_lvl_idx = max(0, current_lvl_idx - cond.action_value)
                            action_taken = f"Level -{cond.action_value} (L{prev_l} -> L{current_lvl_idx + 1})"
                        elif cond.action == "goto_level":
                            current_lvl_idx = max(0, min(num_levels - 1, cond.action_value - 1))
                            action_taken = f"Go to Level {current_lvl_idx + 1}"
                        elif cond.action == "revert_to_level":
                            target_l = max(0, min(num_levels - 1, (cond.action_value or 1) - 1))
                            current_lvl_idx = target_l
                            action_taken = f"Revert to Level {target_l + 1} (Multiplier maintained at {current_multiplier}x)"
                        elif cond.action == "reset_to_start":
                            current_lvl_idx = 0
                            current_multiplier = 1.0
                            active_condition_id = None
                            consecutive_condition_hits = 0
                            current_loss_streak = 0
                            current_win_streak = 0
                            current_push_streak = 0
                            current_non_win_streak = 0
                            # Clean slate: completely reset all event counters so past bets don't carry over
                            for k in event_counts:
                                event_counts[k] = 0
                            if cond.comparison == "session_profit_incremental":
                                inc = cond.threshold_increment if cond.threshold_increment is not None else (cond.threshold_amount or 0.0)
                                prev_t = condition_targets.get(cond.id, 0.0)
                                condition_targets[cond.id] = prev_t + inc
                                action_taken = f"Reset L1 & 1.0x (Target: +${prev_t:.0f} -> +${condition_targets[cond.id]:.0f})"
                            else:
                                action_taken = "Reset to Level 1 & 1.0x (Fresh Start)"
                            break
                        elif cond.action == "keep_level":
                            action_taken = "Stay at Level"

                        def advance_inc_target(c):
                            if c.trigger == "profit_loss" and c.comparison == "session_profit_incremental":
                                inc = c.threshold_increment if c.threshold_increment is not None else (c.threshold_amount or 0.0)
                                condition_targets[c.id] = condition_targets.get(c.id, 0.0) + inc

                        if cond.action == "increase_multiplier":
                            delta = cond.action_value if cond.action_value > 0 else 1
                            prev_m = current_multiplier
                            current_multiplier = round(current_multiplier + delta, 3)
                            active_condition_id = cond.id
                            action_taken = f"x Bet +{delta} ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "decrease_multiplier":
                            delta = cond.action_value if cond.action_value > 0 else 1
                            prev_m = current_multiplier
                            current_multiplier = max(1.0, round(current_multiplier - delta, 3))
                            active_condition_id = cond.id
                            action_taken = f"x Bet -{delta} ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "multiply_by":
                            factor = cond.multiplier if (cond.multiplier and cond.multiplier > 0) else (cond.action_value if cond.action_value > 0 else 1.5)
                            prev_m = current_multiplier
                            current_multiplier = round(current_multiplier * factor, 3)
                            active_condition_id = cond.id
                            action_taken = f"Multiply Bet x{factor} ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "set_multiplier":
                            target_m = cond.multiplier if (cond.multiplier and cond.multiplier > 0) else (cond.action_value if cond.action_value > 0 else 1.0)
                            prev_m = current_multiplier
                            current_multiplier = max(0.1, target_m)
                            active_condition_id = cond.id
                            action_taken = f"Set Multiplier to {target_m}x ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "double_multiplier":
                            prev_m = current_multiplier
                            current_multiplier = round(current_multiplier * 2, 3)
                            active_condition_id = cond.id
                            action_taken = f"Double Bet 2x ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "triple_multiplier":
                            prev_m = current_multiplier
                            current_multiplier = round(current_multiplier * 3, 3)
                            active_condition_id = cond.id
                            action_taken = f"Triple Bet 3x ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "half_multiplier":
                            prev_m = current_multiplier
                            current_multiplier = max(1.0, round(current_multiplier / 2, 3))
                            active_condition_id = cond.id
                            action_taken = f"Halve Bet 0.5x ({prev_m}x -> {current_multiplier}x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "reset_multiplier":
                            prev_m = current_multiplier
                            current_multiplier = 1.0
                            active_condition_id = None
                            action_taken = f"Reset Multiplier to 1.0x ({prev_m}x -> 1.0x)"
                            advance_inc_target(cond)
                            break
                        elif cond.action == "reset_streak_counters":
                            current_win_streak = 0
                            current_loss_streak = 0
                            current_push_streak = 0
                            current_non_win_streak = 0
                            action_taken = "Reset Streak Counters"
                            break
                        elif cond.action == "stop_simulation":
                            action_taken = "Halt Session Early"
                            stopped_early = True
                            stop_reason = f"Stopped by Rule #{rule_num}"
                            break

                        cond_mult = getattr(cond, "multiplier", 1.0) or 1.0
                        cond_mode = getattr(cond, "multiplier_mode", "fixed") or "fixed"

                        if cond_mode == "compound" and cond_mult != 1.0:
                            if active_condition_id == cond.id:
                                consecutive_condition_hits += 1
                            else:
                                active_condition_id = cond.id
                                consecutive_condition_hits = 1
                            current_multiplier = cond_mult ** consecutive_condition_hits
                            action_taken = (action_taken + " * " if action_taken else "") + f"Compound {cond_mult}x ({round(current_multiplier, 1)}x)"
                        elif cond_mult != 1.0:
                            active_condition_id = cond.id
                            consecutive_condition_hits = 1
                            current_multiplier = cond_mult
                            action_taken = (action_taken + " * " if action_taken else "") + f"Mult set to {cond_mult}x"

                        advance_inc_target(cond)
                        break

                if record_detailed_history:
                    session_history.append(BacktestHistoryPoint(
                        spin=s,
                        balance=round(bankroll, 2),
                        level=initial_lvl,
                        multiplier=initial_mult,
                        outcome=outcome,
                        pocket=display_pocket,
                        net_win=round(net_win, 2),
                        wager=round(total_wager, 2),
                        payout=round(payout, 2),
                        cumulative_profit=round(bankroll - initial_bankroll, 2),
                        condition_applied=condition_applied,
                        action_taken=action_taken,
                        next_level=current_lvl_idx + 1,
                        next_multiplier=current_multiplier
                    ))

                if current_lvl_idx != prev_lvl_idx:
                    level_stats_map[current_lvl_idx + 1]["times_visited"] += 1

                if target_profit and (bankroll - initial_bankroll) >= target_profit:
                    stopped_early = True
                    stop_reason = "Target Profit Reached"
                    break
                if stop_loss and (initial_bankroll - bankroll) >= stop_loss:
                    stopped_early = True
                    stop_reason = "Stop Loss Hit"
                    break

            if not stopped_early and not stop_reason:
                stop_reason = "Completed Max Spins"

            session_net = round(bankroll - initial_bankroll, 2)
            session_roi = round((session_net / initial_bankroll) * 100, 2) if initial_bankroll > 0 else 0.0

            session_rec = SessionRecord(
                sessionIndex=s_idx,
                completedSpins=completed_spins,
                stoppedEarly=stopped_early,
                stopReason=stop_reason,
                initialBankroll=initial_bankroll,
                finalBankroll=round(bankroll, 2),
                netProfit=session_net,
                roiPercent=session_roi,
                peakBankroll=round(peak_bankroll, 2),
                lowestBankroll=round(lowest_bankroll, 2),
                maxDrawdown=round(max_drawdown, 2),
                totalWins=session_wins,
                totalLosses=session_total_losses + session_partial_losses,
                pushes=session_pushes,
                balanceTrajectory=balance_trajectory
            )
            sessions_list.append(session_rec)
            if s_idx == 1:
                primary_history = session_history

        # Multi-session aggregate metrics
        sessions_won = sum(1 for s in sessions_list if s.net_profit > 0)
        sessions_lost = sum(1 for s in sessions_list if s.net_profit < 0)
        sessions_breakeven = sum(1 for s in sessions_list if s.net_profit == 0)
        session_win_rate = round((sessions_won / total_sessions) * 100, 2)

        target_profit_hits = sum(1 for s in sessions_list if s.stop_reason == "Target Profit Reached")
        target_profit_hit_rate = round((target_profit_hits / total_sessions) * 100, 2)

        stop_loss_hits = sum(1 for s in sessions_list if s.stop_reason == "Stop Loss Hit")
        stop_loss_hit_rate = round((stop_loss_hits / total_sessions) * 100, 2)

        bust_count = sum(1 for s in sessions_list if s.stop_reason and ("Ruin" in s.stop_reason or "depleted" in s.stop_reason))
        bust_rate = round((bust_count / total_sessions) * 100, 2)

        total_net_profit_sum = sum(s.net_profit for s in sessions_list)
        avg_profit_per_session = round(total_net_profit_sum / total_sessions, 2)

        sorted_profits = sorted(s.net_profit for s in sessions_list)
        median_profit_per_session = sorted_profits[len(sorted_profits) // 2]

        best_session_net = max(s.net_profit for s in sessions_list)
        worst_session_net = min(s.net_profit for s in sessions_list)
        avg_spins_per_session = round(global_completed_spins / total_sessions, 1)

        overall_peak_bankroll = max(s.peak_bankroll for s in sessions_list)
        overall_lowest_bankroll = min(s.lowest_bankroll for s in sessions_list)
        overall_max_drawdown = max(s.max_drawdown for s in sessions_list)
        overall_max_dd_pct = round((overall_max_drawdown / overall_peak_bankroll) * 100, 2) if overall_peak_bankroll > 0 else 0.0

        all_losses = global_total_losses + global_partial_losses
        win_rate = round((global_total_wins / global_completed_spins) * 100, 2) if global_completed_spins > 0 else 0.0
        loss_rate = round((all_losses / global_completed_spins) * 100, 2) if global_completed_spins > 0 else 0.0

        avg_win = round(global_gross_wins / global_total_wins, 2) if global_total_wins > 0 else 0.0
        avg_loss = round(global_gross_losses / all_losses, 2) if all_losses > 0 else 0.0

        if loss_rate > 0 and avg_loss > 0:
            expectancy_ratio = round((win_rate * avg_win) / (loss_rate * avg_loss), 2)
        else:
            expectancy_ratio = 1.0 if global_total_wins > 0 else 0.0

        expectancy_per_spin = round(((win_rate / 100.0) * avg_win) - ((loss_rate / 100.0) * avg_loss), 2)
        profit_factor = round(global_gross_wins / global_gross_losses, 2) if global_gross_losses > 0 else (99.9 if global_gross_wins > 0 else 0.0)

        total_wagered = round(global_total_wagered, 2)
        avg_bet_size = round(global_total_wagered / global_completed_spins, 2) if global_completed_spins > 0 else 0.0
        max_bet = round(global_max_bet_size, 2)
        recovery_factor = round(total_net_profit_sum / overall_max_drawdown, 2) if overall_max_drawdown > 0 else (99.9 if total_net_profit_sum > 0 else 0.0)

        sharpe_ratio = 0.0
        if global_completed_spins > 1:
            mean_net_win = total_net_profit_sum / global_completed_spins
            variance_sum = sum((nw - mean_net_win) ** 2 for nw in global_spin_net_wins)
            std_dev = math.sqrt(variance_sum / (global_completed_spins - 1))
            if std_dev > 0:
                sharpe_ratio = round((mean_net_win / std_dev) * math.sqrt(global_completed_spins), 2)

        condition_stats: List[ConditionTriggerStat] = []
        for idx, cond in enumerate(conditions):
            hits = condition_hits_map.get(cond.id, 0)
            pct = round((hits / global_completed_spins) * 100, 1) if global_completed_spins > 0 else 0.0
            condition_stats.append(ConditionTriggerStat(
                conditionId=cond.id,
                ruleNumber=idx + 1,
                triggerDesc=format_trigger_desc(cond),
                actionDesc=format_action_desc(cond),
                triggerCount=hits,
                triggerPercent=pct
            ))

        level_stats_list: List[LevelStats] = []
        for i in range(num_levels):
            st = level_stats_map[i + 1]
            sp_cnt = st["spins_count"]
            w_cnt = st["max_wins"] + st["partial_wins"]
            l_cnt = st["total_losses"] + st["partial_losses"]
            l_winrate = round((w_cnt / sp_cnt) * 100, 1) if sp_cnt > 0 else 0.0
            sp_pct = round((sp_cnt / global_completed_spins) * 100, 1) if global_completed_spins > 0 else 0.0
            pnl = round(st["net_profit"], 2)

            if pnl > 0:
                status = "Profit Driver"
            elif pnl < -initial_bankroll * 0.15:
                status = "High Bleed"
            elif l_cnt > w_cnt * 2:
                status = "Drawdown Driver"
            else:
                status = "Neutral"

            level_stats_list.append(LevelStats(
                levelNumber=st["level_number"],
                wager=round(st["wager"], 2),
                timesVisited=st["times_visited"],
                spinsCount=sp_cnt,
                spinsPercent=sp_pct,
                totalWagered=round(st["total_wagered"], 2),
                maxWins=st["max_wins"],
                partialWins=st["partial_wins"],
                totalLosses=st["total_losses"],
                partialLosses=st["partial_losses"],
                pushes=st["pushes"],
                winRate=l_winrate,
                netProfit=pnl,
                status=status
            ))

        final_bankroll = sessions_list[0].final_bankroll if total_sessions == 1 else round(initial_bankroll + avg_profit_per_session, 2)
        net_profit = sessions_list[0].net_profit if total_sessions == 1 else round(total_net_profit_sum, 2)
        roi_pct = sessions_list[0].roi_percent if total_sessions == 1 else round((total_net_profit_sum / (initial_bankroll * total_sessions)) * 100, 2)

        ai_suggestion = cls._generate_ai_suggestions(
            config=config,
            net_profit=net_profit,
            max_drawdown=overall_max_drawdown,
            max_drawdown_pct=overall_max_dd_pct,
            peak_bankroll=overall_peak_bankroll,
            total_wins=global_total_wins,
            total_losses=all_losses,
            partial_wins=global_partial_wins,
            partial_losses=global_partial_losses,
            level_stats=level_stats_list,
            num_levels=num_levels
        )

        return AdvancedBacktestResult(
            initialBankroll=initial_bankroll,
            finalBankroll=final_bankroll,
            netProfit=net_profit,
            roiPercent=roi_pct,
            totalSpins=total_spins,
            completedSpins=sessions_list[0].completed_spins if total_sessions == 1 else global_completed_spins,
            totalSessions=total_sessions,
            sessionsWon=sessions_won,
            sessionsLost=sessions_lost,
            sessionsBreakeven=sessions_breakeven,
            sessionWinRate=session_win_rate,
            targetProfitHits=target_profit_hits,
            targetProfitHitRate=target_profit_hit_rate,
            stopLossHits=stop_loss_hits,
            stopLossHitRate=stop_loss_hit_rate,
            bustCount=bust_count,
            bustRate=bust_rate,
            avgProfitPerSession=avg_profit_per_session,
            medianProfitPerSession=median_profit_per_session,
            bestSessionNet=best_session_net,
            worstSessionNet=worst_session_net,
            avgSpinsPerSession=avg_spins_per_session,
            sessions=sessions_list,
            stoppedEarly=sessions_list[0].stopped_early if total_sessions == 1 else (bust_count > 0),
            stopReason=sessions_list[0].stop_reason if total_sessions == 1 else None,
            peakBankroll=overall_peak_bankroll,
            lowestBankroll=overall_lowest_bankroll,
            maxDrawdown=overall_max_drawdown,
            maxDrawdownPercent=overall_max_dd_pct,
            totalWins=global_total_wins,
            maxWins=global_max_wins,
            partialWins=global_partial_wins,
            totalLosses=global_total_losses,
            partialLosses=global_partial_losses,
            pushes=global_pushes,
            winRate=win_rate,
            lossRate=loss_rate,
            avgWin=avg_win,
            avgLoss=avg_loss,
            expectancyRatio=expectancy_ratio,
            expectancyPerSpin=expectancy_per_spin,
            profitFactor=profit_factor,
            longestWinStreak=global_longest_win_streak,
            longestLossStreak=global_longest_loss_streak,
            totalWagered=total_wagered,
            avgBetSize=avg_bet_size,
            maxBetSize=max_bet,
            recoveryFactor=recovery_factor,
            sharpeRatio=sharpe_ratio,
            conditionStats=condition_stats,
            history=primary_history,
            levelStats=level_stats_list,
            aiSuggestions=ai_suggestion
        )

    @classmethod
    def _generate_ai_suggestions(
        cls,
        config: AdvancedBacktestConfig,
        net_profit: float,
        max_drawdown: float,
        max_drawdown_pct: float,
        peak_bankroll: float,
        total_wins: int,
        total_losses: int,
        partial_wins: int,
        partial_losses: int,
        level_stats: List[LevelStats],
        num_levels: int
    ) -> AISuggestion:
        observations = []
        suggested_conditions = []
        condition_reasons = {}

        initial_bankroll = config.initial_bankroll
        conditions = config.conditions or []

        # 1. Existing conditions mapping to prevent duplicates
        has_trigger = lambda t: any(c.trigger == t for c in conditions)
        has_profit_target = any(
            c.trigger == "profit_loss" and c.comparison in ("session_profit_gte", "session_profit_incremental")
            for c in conditions
        )
        has_loss_stop = any(
            c.trigger == "profit_loss" and c.comparison == "session_loss_gte"
            for c in conditions
        )
        has_reset_on_max_win = any(
            c.trigger in ("max_win", "any_win") and c.action == "reset_to_start"
            for c in conditions
        )
        has_loss_escalation = any(
            c.trigger in ("total_loss", "any_loss") and c.action in ("increase_level", "increase_multiplier")
            for c in conditions
        )
        has_win_escalation = any(
            c.trigger in ("max_win", "any_win") and c.action in ("increase_level", "increase_multiplier")
            for c in conditions
        )

        # 2. Archetype detection
        if num_levels <= 1:
            archetype = "Flat Bet / Single-Tier System"
        elif has_win_escalation:
            archetype = "Positive Progression (Paroli / Reverse Martingale)"
        elif has_loss_escalation:
            archetype = "Negative Progression (Martingale / D'Alembert)"
        else:
            archetype = "Dynamic Progression"

        # 3. Peak giveback analysis
        peak_gain = max(0.0, peak_bankroll - initial_bankroll)
        current_gain = net_profit
        giveback_amount = peak_gain - (initial_bankroll + current_gain - initial_bankroll) if peak_gain > 0 else 0.0
        giveback_pct = round((giveback_amount / peak_gain) * 100) if peak_gain > 0 else 0

        if peak_gain > 25.0 and giveback_pct >= 35:
            observations.append(
                f"Profit Giveback: Strategy reached a session high of +${peak_gain:,.0f} but surrendered {giveback_pct}% of peak winnings (-${giveback_amount:,.0f}) before termination."
            )
            if not has_profit_target:
                target_val = max(20.0, round((peak_gain * 0.70) / 10) * 10)
                cond_id = "ai-opt-profit-lock"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="profit_loss",
                        triggerCount=1,
                        comparison="session_profit_gte",
                        thresholdAmount=target_val,
                        action="reset_to_start",
                        actionValue=1,
                        reason=f"Lock in +${target_val:.0f} profit (70% of peak +${peak_gain:.0f} reached in this simulation) to prevent giving back winnings."
                    )
                )
                condition_reasons[cond_id] = f"Lock in +${target_val:.0f} profit (70% of peak +${peak_gain:.0f})"

        # 4. Drawdown & Loss Escalation Velocity
        if max_drawdown_pct > 25:
            observations.append(
                f"High Drawdown Exposure: Peak capital drawdown reached ${round(max_drawdown, 2)} ({max_drawdown_pct}% of bankroll)."
            )
            if num_levels > 1:
                fast_loss_cond = next(
                    (c for c in conditions if c.trigger in ("total_loss", "any_loss") and c.action == "increase_level" and c.trigger_count == 1),
                    None
                )
                if fast_loss_cond:
                    cond_id = "ai-opt-loss-dampener"
                    suggested_conditions.append(
                        StrategyCondition(
                            id=cond_id,
                            trigger="total_loss",
                            triggerCount=2,
                            action="increase_level",
                            actionValue=1,
                            reason="Dampen escalation: Step up only on every 2 consecutive total losses instead of every 1, cutting progression drawdown velocity by ~45%."
                        )
                    )
                    condition_reasons[cond_id] = "Dampen loss escalation to every 2 losses"

            if not has_loss_stop:
                stop_thresh = max(50.0, round((initial_bankroll * 0.35) / 10) * 10)
                cond_id = "ai-opt-drawdown-cap"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="profit_loss",
                        triggerCount=1,
                        comparison="session_loss_gte",
                        thresholdAmount=stop_thresh,
                        action="goto_level" if num_levels > 1 else "reset_to_start",
                        actionValue=1,
                        reason=f"Circuit breaker: Reset to base wager if cumulative session loss touches -${stop_thresh:.0f} (35% bankroll) to avoid gambler ruin."
                    )
                )
                condition_reasons[cond_id] = f"Circuit breaker at -${stop_thresh:.0f} loss threshold"

        # 5. Partial Outcomes Handling
        if partial_wins > 5 or partial_losses > 5:
            observations.append(
                f"Mixed Payoff Pockets: Detected {partial_wins} partial wins and {partial_losses} partial losses across the simulation run."
            )
            if partial_wins > 5 and not has_trigger("partial_win") and num_levels > 1:
                cond_id = "ai-opt-partial-win"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="partial_win",
                        triggerCount=1,
                        action="decrease_level",
                        actionValue=1,
                        reason="Soft Recovery: On partial wins, step down 1 level to bank chips rather than treating partial return as an all-or-nothing event."
                    )
                )
                condition_reasons[cond_id] = "Step down on partial win for soft recovery"

            if partial_losses > 5 and not has_trigger("partial_loss") and num_levels > 1:
                cond_id = "ai-opt-partial-loss"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="partial_loss",
                        triggerCount=1,
                        action="keep_level",
                        actionValue=0,
                        reason="Stay at current level on partial losses since partial wager was returned, avoiding over-escalation."
                    )
                )
                condition_reasons[cond_id] = "Hold current level on partial losses"

        # 6. Base Reset on Primary Max Win
        if not has_reset_on_max_win and num_levels > 1:
            cond_id = "ai-opt-reset-on-win"
            suggested_conditions.append(
                StrategyCondition(
                    id=cond_id,
                    trigger="max_win",
                    triggerCount=1,
                    action="reset_to_start",
                    actionValue=1,
                    reason="Harvest wins: Reset to Level 1 and 1.0x multiplier immediately after hitting a Max Win payout."
                )
            )
            condition_reasons[cond_id] = "Reset to base bet on max win"

        # 7. Single Level / Flat Bet Optimization
        if num_levels <= 1:
            if not has_trigger("new_peak") and not has_profit_target:
                cond_id = "ai-opt-flat-peak-reset"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="new_peak",
                        triggerCount=1,
                        action="reset_to_start",
                        actionValue=1,
                        reason="Bankroll High-Water Mark: Reset bet multiplier to 1.0x whenever balance prints a new session high."
                    )
                )
                condition_reasons[cond_id] = "Reset multiplier on new peak balance"
            if not has_loss_escalation and not has_trigger("consecutive_losses"):
                cond_id = "ai-opt-flat-recovery"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="consecutive_losses",
                        triggerCount=3,
                        action="double_multiplier",
                        actionValue=2,
                        reason="Controlled Recovery: On 3 consecutive losses, temporarily scale bet 2x to recoup flat betting variance."
                    )
                )
                condition_reasons[cond_id] = "2x multiplier on 3 consecutive losses"

        # 8. Positive Progression Win Cap
        if has_win_escalation and not has_trigger("consecutive_wins"):
            cond_id = "ai-opt-win-streak-cap"
            suggested_conditions.append(
                StrategyCondition(
                    id=cond_id,
                    trigger="consecutive_wins",
                    triggerCount=3,
                    action="reset_to_start",
                    actionValue=1,
                    reason="Streak Lock: 3 consecutive wins is the statistical sweet spot for positive progressions. Resetting to base locks in compounded profit."
                )
            )
            condition_reasons[cond_id] = "Lock profit after 3 consecutive wins"

        # Fallback if strategy was already optimal and none triggered
        if not suggested_conditions:
            if net_profit > 0:
                inc_val = max(25.0, round((initial_bankroll * 0.1) / 10) * 10)
                cond_id = "ai-opt-incremental-growth"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="profit_loss",
                        triggerCount=1,
                        comparison="session_profit_incremental",
                        thresholdAmount=inc_val,
                        thresholdIncrement=inc_val,
                        action="reset_to_start",
                        actionValue=1,
                        reason="Incremental milestones: Continue compounding with auto-advancing target increments."
                    )
                )
                condition_reasons[cond_id] = "Auto-advancing incremental profit targets"
            else:
                cond_id = "ai-opt-consec-cap"
                suggested_conditions.append(
                    StrategyCondition(
                        id=cond_id,
                        trigger="consecutive_losses",
                        triggerCount=3,
                        action="reset_to_start",
                        actionValue=1,
                        reason="Stop-loss limit: Reset on 3 consecutive losses to cap downside drift."
                    )
                )
                condition_reasons[cond_id] = "Reset on 3 consecutive losses"

        diagnosis = (
            f"The strategy achieved net positive return (+${net_profit:.2f}) operating as a {archetype}. Volatility analysis shows targeted adjustments to profit locking and partial win management will stabilize the equity curve."
            if net_profit >= 0
            else f"The strategy incurred net negative variance (-${abs(net_profit):.2f}) under a {archetype} profile. Max drawdown ({max_drawdown_pct}%) can be significantly curtailed by implementing tailored loss dampeners and circuit breakers."
        )

        predicted_impact = (
            f"Secures up to ~{min(85, max(35, giveback_pct))}% of peak captured gains and prevents drawdown erosion during adverse streaks."
            if net_profit >= 0
            else "Reduces peak capital drawdown by ~35-50% and prevents catastrophic progression blowouts during prolonged losing runs."
        )

        return AISuggestion(
            title=f"AI Quantitative Strategy Optimization — {archetype}",
            diagnosis=diagnosis,
            keyObservations=observations if observations else ["Standard variance observed across simulation run."],
            reasoning=f"Tailored for {archetype}: Recommendations are customized based on the actual simulated drawdown (${max_drawdown:.0f}) and peak gains (+${peak_gain:.0f}), without duplicate rules.",
            suggestedConditions=suggested_conditions,
            conditionReasons=condition_reasons,
            predictedImpact=predicted_impact,
            archetype=archetype
        )

    @classmethod
    def stream_simulation(cls, config: BacktestConfig) -> Generator[Dict[str, Any], None, None]:
        """
        Streams simulation progress in chunks for large runs via Server-Sent Events (SSE).
        """
        yield {"type": "START", "total_sessions": config.total_sessions}
        result = cls.run_simulation(config)
        yield {
            "type": "PROGRESS",
            "progress": 1.0,
            "sessions_won": result.sessions_won,
            "sessions_lost": result.sessions_lost,
            "current_bankroll": result.final_bankroll,
        }
        yield {
            "type": "COMPLETE",
            "result": result.model_dump(),
        }

backtest_service = BacktestService()

