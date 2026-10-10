import React from 'react';
import { Trash2, Copy, Zap, ArrowRight, CornerDownRight } from 'lucide-react';
import {
  type StrategyCondition,
  type TriggerType,
  type ActionType,
  type ComparisonType,
  formatTriggerDesc,
  formatActionDesc,
} from '../../utils/strategyEngine';
import { CustomSelect, type CustomSelectOption } from '../common/CustomSelect';

interface ConditionRuleCardProps {
  condition: StrategyCondition;
  index: number;
  totalLevels: number;
  currencySymbol: string;
  onUpdate: (id: string, field: keyof StrategyCondition, value: any) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (cond: StrategyCondition) => void;
}

const TRIGGER_OPTIONS: CustomSelectOption<TriggerType>[] = [
  // ── Spin Outcomes ──
  { value: 'total_loss',            label: 'Total Loss',                 description: 'Zero payout returned on spin' },
  { value: 'partial_loss',          label: 'Partial Loss',               description: 'Some bets won, but net result is negative' },
  { value: 'any_loss',              label: 'Any Loss',                   description: 'Either total loss or partial loss' },
  { value: 'push',                  label: 'Push / Break-Even',          description: 'Payout equals total wager (net $0 return)' },
  { value: 'partial_win',           label: 'Partial Win',                description: 'Net profit, but below maximum table payout' },
  { value: 'max_win',               label: 'Max Win',                    description: 'Hit top payout pocket or primary target' },
  { value: 'any_win',               label: 'Any Win',                    description: 'Any spin resulting in a positive net return' },

  // ── Streaks ──
  { value: 'consecutive_losses',    label: 'Consecutive Losses',         description: 'Triggers when consecutive loss streak reaches N spins' },
  { value: 'consecutive_wins',      label: 'Consecutive Wins',           description: 'Triggers when consecutive win streak reaches N spins' },
  { value: 'consecutive_pushes',    label: 'Consecutive Pushes',         description: 'Triggers when consecutive push streak reaches N spins' },
  { value: 'consecutive_non_wins',  label: 'Consecutive Non-Wins',       description: 'Triggers when non-winning streak reaches N spins' },

  // ── Bankroll & Drawdown ──
  { value: 'new_peak',              label: 'New Peak Balance',           description: 'Bankroll reaches a new session high-water mark' },
  { value: 'profit_loss',           label: 'Profit / Loss Milestone',    description: 'Session or spin monetary threshold' },
  { value: 'drawdown_gte',          label: 'Session Drawdown ($) ≥',     description: 'Peak-to-trough drop reaches monetary threshold' },
  { value: 'drawdown_percent_gte',  label: 'Session Drawdown (%) ≥',     description: 'Peak-to-trough drop reaches percentage of peak' },
  { value: 'bankroll_remaining_lte',label: 'Bankroll Remaining ≤',       description: 'Bankroll falls to or below threshold' },
  { value: 'session_roi_gte',       label: 'Session ROI (%) ≥',          description: 'Total session return reaches target percent' },

  // ── Level & Bet Rules ──
  { value: 'level_reached',         label: 'Level Reached (Exact)',      description: 'Progression reaches exact level L' },
  { value: 'level_at_least',        label: 'Level At Least (≥ L)',       description: 'Progression is at or above level L' },
  { value: 'spin_count_reached',    label: 'Spin Count Reached',         description: 'Triggers at spin #N or every N spins' },
  { value: 'bet_size_gte',          label: 'Total Bet Size ≥',           description: 'Single spin total wager reaches or exceeds $' },
];

const ACTION_OPTIONS: CustomSelectOption<ActionType>[] = [
  // ── Progression Level Actions ──
  { value: 'increase_level',        label: 'Step Up Progression Level',        description: 'Advance forward to higher wager level (+N)' },
  { value: 'decrease_level',        label: 'Step Down Progression Level',      description: 'Move backward to lower wager level (−N)' },
  { value: 'goto_level',            label: 'Jump to Specific Level',           description: 'Go directly to a chosen progression level' },
  { value: 'revert_to_level',       label: 'Revert to Safety Level',           description: 'Revert to level (e.g. L1) while preserving multiplier' },
  { value: 'keep_level',            label: 'Stay at Current Level',            description: 'Maintain current progression level' },
  { value: 'reset_to_start',        label: 'Reset to Base Bet (L1 & 1.0×)',    description: 'Return to start of progression with fresh counters' },

  // ── Multiplier Scaling Actions ──
  { value: 'increase_multiplier',   label: 'Increase Bet Multiplier (+N)',     description: 'Additively scale current bet multiplier' },
  { value: 'decrease_multiplier',   label: 'Decrease Bet Multiplier (−N)',     description: 'Reduce current bet multiplier (min 1.0×)' },
  { value: 'multiply_by',           label: 'Scale Multiplier by Factor (×N)',   description: 'Geometric multiplication (e.g. 1.5×, 2×)' },
  { value: 'set_multiplier',        label: 'Set Exact Multiplier (N×)',        description: 'Directly set bet multiplier to specific value' },
  { value: 'double_multiplier',     label: 'Double Current Bet (2×)',          description: 'Multiplies active multiplier by 2' },
  { value: 'triple_multiplier',     label: 'Triple Current Bet (3×)',          description: 'Multiplies active multiplier by 3' },
  { value: 'half_multiplier',       label: 'Halve Current Bet (0.5×)',         description: 'Divides active multiplier by 2 (min 1.0×)' },
  { value: 'reset_multiplier',      label: 'Reset Multiplier to 1.0×',         description: 'Resets multiplier to 1.0× without changing level' },

  // ── Session Controls ──
  { value: 'reset_streak_counters', label: 'Reset Streak Counters',          description: 'Clears win/loss/push streaks without resetting level' },
  { value: 'stop_simulation',       label: 'Halt Session Early',               description: 'Immediately exits session and locks current balance' },
];

const COMPARISON_OPTIONS: CustomSelectOption<ComparisonType>[] = [
  { value: 'session_profit_incremental', label: 'Incremental Session Profit Target', description: 'Advances goal automatically upon hitting target' },
  { value: 'session_profit_gte',         label: 'Cumulative Session Profit ≥',       description: 'Fixed cumulative profit monetary threshold' },
  { value: 'session_loss_gte',           label: 'Cumulative Session Loss ≥',         description: 'Fixed cumulative loss monetary threshold' },
  { value: 'spin_profit_gte',            label: 'Single Spin Profit ≥',              description: 'Single spin net win monetary threshold' },
  { value: 'spin_loss_gte',              label: 'Single Spin Loss ≥',               description: 'Single spin net loss monetary threshold' },
  { value: 'peak_profit_giveback',       label: 'Profit Giveback from Peak ≥',       description: 'Profit drops by $X from its session peak' },
  { value: 'spin_profit_pct_wager',      label: 'Single Spin Return ≥ N× Wager',     description: 'Payout is at least N times the spin wager amount' },
];

export const ConditionRuleCard: React.FC<ConditionRuleCardProps> = ({
  condition,
  index,
  totalLevels,
  currencySymbol,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const isProfitLoss       = condition.trigger === 'profit_loss';
  const isIncremental      = condition.comparison === 'session_profit_incremental';
  const isOutcome          = ['total_loss', 'partial_loss', 'any_loss', 'push', 'partial_win', 'max_win', 'any_win', 'new_peak'].includes(condition.trigger);
  const isStreak           = ['consecutive_losses', 'consecutive_wins', 'consecutive_pushes', 'consecutive_non_wins'].includes(condition.trigger);
  const isSpinCount        = condition.trigger === 'spin_count_reached';
  const isDrawdownDollar   = condition.trigger === 'drawdown_gte';
  const isDrawdownPercent  = condition.trigger === 'drawdown_percent_gte';
  const isBankrollFloor    = condition.trigger === 'bankroll_remaining_lte';
  const isSessionRoi       = condition.trigger === 'session_roi_gte';
  const isLevelTrigger     = condition.trigger === 'level_reached' || condition.trigger === 'level_at_least';
  const isBetSizeTrigger   = condition.trigger === 'bet_size_gte';

  const isLevelStepAction  = condition.action === 'increase_level' || condition.action === 'decrease_level';
  const isTargetLevelJump  = condition.action === 'goto_level' || condition.action === 'revert_to_level';
  const isLevelNavigation  = isLevelStepAction || isTargetLevelJump;
  const isMultiplierDelta  = condition.action === 'increase_multiplier' || condition.action === 'decrease_multiplier';
  const isMultiplierFactor = condition.action === 'multiply_by';
  const isMultiplierSet    = condition.action === 'set_multiplier';

  const isNoValueAction =
    condition.action === 'reset_to_start' ||
    condition.action === 'keep_level' ||
    condition.action === 'double_multiplier' ||
    condition.action === 'triple_multiplier' ||
    condition.action === 'half_multiplier' ||
    condition.action === 'reset_multiplier' ||
    condition.action === 'reset_streak_counters' ||
    condition.action === 'stop_simulation';

  // Natural Language Description
  const triggerSummary = formatTriggerDesc(condition);
  const actionSummary = formatActionDesc(condition);

  return (
    <div className="bg-[#0b130f] border border-white/12 hover:border-emerald-500/40 rounded-2xl p-4 shadow-lg transition-all duration-200 group">
      {/* ── Rule Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-white/8 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[#00ff87] font-mono text-xs font-bold shrink-0">
            Rule #{index + 1}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-gray-200 truncate" title={`${triggerSummary} ➔ ${actionSummary}`}>
            <span className="text-amber-300">{triggerSummary}</span>
            <span className="text-gray-500 mx-1.5">➔</span>
            <span className="text-[#00ff87]">{actionSummary}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(condition)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
              title="Duplicate this rule"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(condition.id)}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
            title="Delete this rule"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Rule Body: WHEN & THEN Sections ── */}
      <div className="pt-3 space-y-3">
        {/* ── WHEN (Trigger Block) ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Zap className="w-3.5 h-3.5" />
            <span>WHEN Condition Triggered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            {/* Trigger Event Selector */}
            <div className={isOutcome || isStreak || isSpinCount || isDrawdownDollar || isDrawdownPercent || isBankrollFloor || isSessionRoi || isLevelTrigger || isBetSizeTrigger ? 'sm:col-span-7' : 'sm:col-span-12'}>
              <CustomSelect
                value={condition.trigger}
                options={TRIGGER_OPTIONS}
                onChange={(val) => {
                  onUpdate(condition.id, 'trigger', val);
                  if (val === 'profit_loss' && !condition.comparison) {
                    onUpdate(condition.id, 'comparison', 'session_profit_gte');
                    onUpdate(condition.id, 'thresholdAmount', 100);
                  } else if (val === 'drawdown_percent_gte' && !condition.thresholdAmount) {
                    onUpdate(condition.id, 'thresholdAmount', 20);
                  } else if (val === 'session_roi_gte' && !condition.thresholdAmount) {
                    onUpdate(condition.id, 'thresholdAmount', 25);
                  } else if (val === 'bankroll_remaining_lte' && !condition.thresholdAmount) {
                    onUpdate(condition.id, 'thresholdAmount', 50);
                  } else if (val === 'bet_size_gte' && !condition.thresholdAmount) {
                    onUpdate(condition.id, 'thresholdAmount', 100);
                  } else if ((val === 'consecutive_losses' || val === 'consecutive_wins' || val === 'consecutive_pushes' || val === 'consecutive_non_wins') && (condition.triggerCount < 2)) {
                    onUpdate(condition.id, 'triggerCount', 2);
                  }
                }}
                className="w-full"
              />
            </div>

            {/* Recurrence Counter (Outcome spins) */}
            {isOutcome && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Every</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={condition.triggerCount || 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'triggerCount', n);
                  }}
                  className="w-10 bg-transparent text-center font-bold text-white text-sm outline-none focus:text-[#00ff87]"
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">occurrence(s)</span>
              </div>
            )}

            {/* Streak Counter */}
            {isStreak && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Streak:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={condition.triggerCount || 2}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'triggerCount', n);
                  }}
                  className="w-10 bg-transparent text-center font-bold text-white text-sm outline-none focus:text-[#00ff87]"
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">spins</span>
              </div>
            )}

            {/* Spin Count Target */}
            {isSpinCount && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Spin #</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={condition.triggerCount || 50}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) {
                      onUpdate(condition.id, 'triggerCount', n);
                      onUpdate(condition.id, 'thresholdAmount', n);
                    }
                  }}
                  className="w-14 bg-transparent text-center font-bold text-white text-sm outline-none focus:text-[#00ff87]"
                />
              </div>
            )}

            {/* Monetary Threshold (Drawdown $, Bankroll Floor, Bet Size) */}
            {(isDrawdownDollar || isBankrollFloor || isBetSizeTrigger) && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 font-bold">{currencySymbol}</span>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={condition.thresholdAmount || (isBankrollFloor ? 50 : 100)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n) && n >= 0) onUpdate(condition.id, 'thresholdAmount', n);
                  }}
                  className="w-full bg-transparent text-right font-bold text-white text-xs outline-none focus:text-[#00ff87]"
                />
              </div>
            )}

            {/* Percentage Threshold (Drawdown %, Session ROI %) */}
            {(isDrawdownPercent || isSessionRoi) && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="5"
                  value={condition.thresholdAmount || (isDrawdownPercent ? 20 : 25)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'thresholdAmount', n);
                  }}
                  className="w-full bg-transparent text-right font-bold text-white text-xs outline-none focus:text-[#00ff87]"
                />
                <span className="text-xs text-[#00ff87] font-bold">%</span>
              </div>
            )}

            {/* Level Threshold */}
            {isLevelTrigger && (
              <div className="sm:col-span-5 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Level</span>
                <input
                  type="number"
                  min="1"
                  max={totalLevels || 10}
                  value={condition.actionValue || condition.thresholdAmount || 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) {
                      onUpdate(condition.id, 'actionValue', n);
                      onUpdate(condition.id, 'thresholdAmount', n);
                    }
                  }}
                  className="w-10 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
                <span className="text-xs text-gray-400">/ {totalLevels}</span>
              </div>
            )}
          </div>

          {/* Special Inputs for Profit/Loss Milestones */}
          {isProfitLoss && (
            <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <CornerDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-gray-400 font-medium">Milestone Comparison:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <CustomSelect
                    value={condition.comparison || 'session_profit_gte'}
                    options={COMPARISON_OPTIONS}
                    onChange={(val) => onUpdate(condition.id, 'comparison', val)}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center gap-1 bg-[#0e1713] border border-white/15 rounded-lg px-2 py-1">
                  {condition.comparison !== 'spin_profit_pct_wager' && (
                    <span className="text-gray-400 font-semibold">{currencySymbol}</span>
                  )}
                  <input
                    type="number"
                    min="1"
                    step={condition.comparison === 'spin_profit_pct_wager' ? '0.5' : '5'}
                    placeholder="Amount"
                    value={condition.thresholdAmount || (condition.comparison === 'spin_profit_pct_wager' ? 2 : 100)}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n >= 0) onUpdate(condition.id, 'thresholdAmount', n);
                    }}
                    className="w-full bg-transparent text-right font-bold text-white text-xs outline-none focus:text-[#00ff87]"
                  />
                  {condition.comparison === 'spin_profit_pct_wager' && (
                    <span className="text-[#00ff87] font-bold">×</span>
                  )}
                </div>
              </div>

              {isIncremental && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 text-[11px] text-gray-400">
                  <span>Auto-Advance Goal Step:</span>
                  <div className="flex items-center gap-1 bg-[#0e1713] border border-emerald-500/30 rounded-lg px-2 py-0.5">
                    <span className="text-[#00ff87] font-bold">+{currencySymbol}</span>
                    <input
                      type="number"
                      min="1"
                      step="5"
                      placeholder="Step"
                      value={condition.thresholdIncrement || condition.thresholdAmount || 20}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'thresholdIncrement', n);
                      }}
                      className="w-16 bg-transparent text-right font-bold text-[#00ff87] text-xs outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── THEN (Action Block) ── */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#00ff87]">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>THEN Execute Action</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            {/* Action Type Selector */}
            <div className={isNoValueAction ? 'sm:col-span-12' : 'sm:col-span-8'}>
              <CustomSelect
                value={condition.action}
                options={ACTION_OPTIONS}
                onChange={(val) => onUpdate(condition.id, 'action', val)}
                className="w-full"
              />
            </div>

            {/* Level Step Count */}
            {isLevelStepAction && (
              <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Steps:</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={condition.actionValue || 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'actionValue', n);
                  }}
                  className="w-12 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
              </div>
            )}

            {/* Target Level Jump / Revert */}
            {isTargetLevelJump && (
              <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Target L#</span>
                <input
                  type="number"
                  min="1"
                  max={totalLevels || 10}
                  value={condition.actionValue || 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'actionValue', n);
                  }}
                  className="w-12 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
              </div>
            )}

            {/* Multiplier Additive Delta */}
            {isMultiplierDelta && (
              <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {condition.action === 'increase_multiplier' ? '+By' : '−By'}
                </span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={condition.actionValue || 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) onUpdate(condition.id, 'actionValue', n);
                  }}
                  className="w-12 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
                <span className="text-xs text-[#00ff87] font-bold">×</span>
              </div>
            )}

            {/* Multiplier Geometric Factor */}
            {isMultiplierFactor && (
              <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Factor:</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="50"
                  value={condition.multiplier !== undefined ? condition.multiplier : (condition.actionValue || 1.5)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n) && n >= 0.1) {
                      onUpdate(condition.id, 'multiplier', n);
                      onUpdate(condition.id, 'actionValue', Math.round(n));
                    }
                  }}
                  className="w-12 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
                <span className="text-xs text-[#00ff87] font-bold">×</span>
              </div>
            )}

            {/* Exact Multiplier Set */}
            {isMultiplierSet && (
              <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#0e1713] border border-white/15 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Set:</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="100"
                  value={condition.multiplier !== undefined ? condition.multiplier : (condition.actionValue || 1.0)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n) && n >= 0.1) {
                      onUpdate(condition.id, 'multiplier', n);
                      onUpdate(condition.id, 'actionValue', Math.round(n));
                    }
                  }}
                  className="w-12 bg-transparent text-center font-bold text-[#00ff87] text-sm outline-none"
                />
                <span className="text-xs text-[#00ff87] font-bold">×</span>
              </div>
            )}
          </div>

          {/* Level Bet Multiplier Scaling (Only for Level Navigation actions) */}
          {isLevelNavigation && (
            <div className="flex items-center justify-between gap-3 p-2 bg-[#0e1713] border border-white/10 rounded-xl text-xs">
              <span className="text-gray-400 font-medium">Bet Multiplier for Target Level:</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-black/40 border border-white/15 rounded-lg px-2 py-1">
                  <span className="text-[#00ff87] font-bold text-xs">×</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={condition.multiplier !== undefined ? condition.multiplier : 1.0}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n >= 0.1) onUpdate(condition.id, 'multiplier', n);
                    }}
                    className="w-10 bg-transparent text-center font-bold text-[#00ff87] text-xs outline-none"
                  />
                </div>

                <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onUpdate(condition.id, 'multiplierMode', 'fixed')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      condition.multiplierMode !== 'compound'
                        ? 'bg-emerald-500/30 text-[#00ff87] font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Fixed Scale: Bet = Base × Multiplier"
                  >
                    Fixed
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(condition.id, 'multiplierMode', 'compound')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      condition.multiplierMode === 'compound'
                        ? 'bg-emerald-500/30 text-[#00ff87] font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Compounding: Multiplier compounds exponentially across consecutive triggers"
                  >
                    Compound
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
