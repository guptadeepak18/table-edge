import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Trash2,
  Copy,
  Plus,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import {
  type StrategyCondition,
  type TriggerType,
  type ActionType,
  type ComparisonType,
  formatTriggerDesc,
  formatActionDesc,
} from '../../utils/strategyEngine';
import { CustomSelect, type CustomSelectOption } from '../common/CustomSelect';
import { NumericInput } from '../common/NumericInput';

interface WorkflowPipelineProps {
  conditions: StrategyCondition[];
  totalLevels: number;
  currencySymbol: string;
  onAdd: (initial?: Partial<StrategyCondition>) => void;
  onUpdate: (id: string, field: keyof StrategyCondition, value: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (cond: StrategyCondition) => void;
}

const TRIGGER_OPTIONS: CustomSelectOption<TriggerType>[] = [
  // ── Spin Outcomes ──
  { value: 'total_loss',            label: 'Total Loss',                 description: 'Zero payout — all placed bets lost on spin' },
  { value: 'partial_loss',          label: 'Partial Loss',               description: 'Some bets won, but net spin return is negative' },
  { value: 'any_loss',              label: 'Any Loss',                   description: 'Either total loss or partial loss' },
  { value: 'push',                  label: 'Push / Break-Even',          description: 'Payout equals total wager (net $0 return)' },
  { value: 'partial_win',           label: 'Partial Win',                description: 'Net profit, but below maximum payout tier' },
  { value: 'max_win',               label: 'Max Win',                    description: 'Hit highest payout pocket or primary bet target' },
  { value: 'any_win',               label: 'Any Win',                    description: 'Any spin resulting in a positive net return' },

  // ── Streaks ──
  { value: 'consecutive_losses',    label: 'Consecutive Losses',         description: 'Triggers when consecutive loss streak reaches N spins' },
  { value: 'consecutive_wins',      label: 'Consecutive Wins',           description: 'Triggers when consecutive win streak reaches N spins' },
  { value: 'consecutive_pushes',    label: 'Consecutive Pushes',         description: 'Triggers when consecutive push streak reaches N spins' },
  { value: 'consecutive_non_wins',  label: 'Consecutive Non-Wins',       description: 'Triggers when non-winning streak (losses & pushes) reaches N' },

  // ── Bankroll & Drawdown ──
  { value: 'new_peak',              label: 'New Peak Balance',           description: 'Bankroll reaches a new session high-water mark' },
  { value: 'profit_loss',           label: 'Profit / Loss Milestone',    description: 'Cumulative session or spin monetary threshold' },
  { value: 'drawdown_gte',          label: 'Session Drawdown ($) ≥',     description: 'Peak-to-trough drop reaches or exceeds monetary amount' },
  { value: 'drawdown_percent_gte',  label: 'Session Drawdown (%) ≥',     description: 'Peak-to-trough drop reaches or exceeds percentage of peak' },
  { value: 'bankroll_remaining_lte',label: 'Bankroll Remaining ≤',       description: 'Triggers when active bankroll falls to or below threshold' },
  { value: 'session_roi_gte',       label: 'Session ROI (%) ≥',          description: 'Triggers when total session ROI reaches target percent' },

  // ── Level & Bet Rules ──
  { value: 'level_reached',         label: 'Level Reached (Exact)',      description: 'Triggers when progression hits specific level L' },
  { value: 'level_at_least',        label: 'Level At Least (≥ L)',       description: 'Triggers when progression is at or above level L' },
  { value: 'spin_count_reached',    label: 'Spin Count Reached',         description: 'Triggers at spin #N or every N spins' },
  { value: 'bet_size_gte',          label: 'Total Bet Size ≥',           description: 'Triggers when single spin total wager reaches or exceeds $' },
];

const ACTION_OPTIONS: CustomSelectOption<ActionType>[] = [
  // ── Progression Level Actions ──
  { value: 'increase_level',        label: 'Step Up Progression Level',        description: 'Advance forward by +N higher wager level(s)' },
  { value: 'decrease_level',        label: 'Step Down Progression Level',      description: 'Step backward by −N lower wager level(s)' },
  { value: 'goto_level',            label: 'Jump to Specific Level',           description: 'Go directly to a chosen progression level' },
  { value: 'revert_to_level',       label: 'Revert to Safety Level',           description: 'Revert to chosen level (e.g. L1) while preserving multiplier' },
  { value: 'keep_level',            label: 'Stay at Current Level',            description: 'Maintain level — adjust multiplier only' },
  { value: 'reset_to_start',        label: 'Reset to Base Bet (L1 · 1.0×)',    description: 'Return to Level 1 with 1.0× multiplier and fresh counters' },

  // ── Multiplier Scaling Actions ──
  { value: 'increase_multiplier',   label: 'Increase Bet Multiplier (+N)',     description: 'Additively scale current bet multiplier (+1, +2, etc.)' },
  { value: 'decrease_multiplier',   label: 'Decrease Bet Multiplier (−N)',     description: 'Reduce current bet multiplier (min 1.0×)' },
  { value: 'multiply_by',           label: 'Scale Multiplier by Factor (×N)',   description: 'Geometric multiplication (e.g. 1.5×, 2×, 2.5×)' },
  { value: 'set_multiplier',        label: 'Set Exact Multiplier (N×)',        description: 'Directly set bet multiplier to specific value' },
  { value: 'double_multiplier',     label: 'Double Current Bet (2×)',          description: 'Multiplies active multiplier by 2' },
  { value: 'triple_multiplier',     label: 'Triple Current Bet (3×)',          description: 'Multiplies active multiplier by 3' },
  { value: 'half_multiplier',       label: 'Halve Current Bet (0.5×)',         description: 'Divides active multiplier by 2 (min 1.0×)' },
  { value: 'reset_multiplier',      label: 'Reset Multiplier to 1.0×',         description: 'Resets multiplier to 1.0× without changing level' },

  // ── Session Controls ──
  { value: 'reset_streak_counters', label: 'Reset Streak Counters',          description: 'Clears win/loss/push streaks without resetting level or bet' },
  { value: 'stop_simulation',       label: 'Halt Session Early',               description: 'Immediately exits session and locks current balance' },
];

const COMPARISON_OPTIONS: CustomSelectOption<ComparisonType>[] = [
  { value: 'session_profit_incremental', label: 'Incremental Session Profit Target', description: 'Auto-advances goal step each time target is hit' },
  { value: 'session_profit_gte',         label: 'Cumulative Session Profit ≥',       description: 'Fixed cumulative profit monetary threshold' },
  { value: 'session_loss_gte',           label: 'Cumulative Session Loss ≥',         description: 'Fixed cumulative loss monetary threshold' },
  { value: 'spin_profit_gte',            label: 'Single Spin Profit ≥',              description: 'Single spin net win monetary threshold' },
  { value: 'spin_loss_gte',              label: 'Single Spin Loss ≥',               description: 'Single spin net loss monetary threshold' },
  { value: 'peak_profit_giveback',       label: 'Profit Giveback from Peak ≥',       description: 'Profit retraces/drops by $X from its session peak' },
  { value: 'spin_profit_pct_wager',      label: 'Single Spin Return ≥ N× Wager',     description: 'Payout is at least N times the spin wager amount' },
];

// ─── Flat Step Node (No Card Style) ──────────────────────────────────────────

interface StepNodeProps {
  condition: StrategyCondition;
  index: number;
  totalLevels: number;
  currencySymbol: string;
  triggerOptions: CustomSelectOption<TriggerType>[];
  actionOptions: CustomSelectOption<ActionType>[];
  onUpdate: (id: string, field: keyof StrategyCondition, value: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (cond: StrategyCondition) => void;
}

const StepNode: React.FC<StepNodeProps> = ({
  condition,
  index,
  totalLevels,
  currencySymbol,
  triggerOptions,
  actionOptions,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const [expanded, setExpanded] = useState(true);

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
  const isLevelNav         = isLevelStepAction || isTargetLevelJump;
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

  const triggerSummary = formatTriggerDesc(condition);
  const actionSummary  = formatActionDesc(condition);

  return (
    <div className="py-3 border-b border-white/[0.08] last:border-b-0 space-y-2">
      {/* ── Rule Header Row (Clean, flat) ── */}
      <div
        className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none group"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-mono font-bold text-gray-500 w-6 shrink-0">
            #{index + 1}
          </span>
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="text-amber-300 font-semibold truncate">{triggerSummary}</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <span className="text-emerald-400 font-semibold truncate">{actionSummary}</span>
          </div>
        </div>

        {/* Rule Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onDuplicate(condition)}
            className="p-1 text-gray-500 hover:text-gray-300 transition"
            title="Duplicate rule"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(condition.id)}
            className="p-1 text-gray-500 hover:text-red-400 transition"
            title="Delete rule"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 text-gray-500 hover:text-gray-300 transition"
            title={expanded ? 'Collapse rule' : 'Expand rule'}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── AI Rationale (if attached) ── */}
      {condition.reason && (
        <div className="pl-8 text-xs text-gray-400 flex items-start gap-1.5 leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span><strong className="text-emerald-400 font-medium">Why:</strong> {condition.reason}</span>
        </div>
      )}

      {/* ── Rule Form Fields (Flat, clean, no boxes) ── */}
      {expanded && (
        <div className="pl-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">

            {/* ── WHEN BLOCK ── */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                WHEN (Condition Trigger)
              </span>

              {/* Trigger Event */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Trigger Event</label>
                <CustomSelect<TriggerType>
                  value={condition.trigger}
                  options={triggerOptions}
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
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Recurrence Counter (For outcome spins) */}
              {isOutcome && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Recurrence Frequency</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Every</span>
                    <NumericInput
                      value={condition.triggerCount}
                      defaultValue={1}
                      min={1}
                      max={100}
                      onChange={(n) => onUpdate(condition.id, 'triggerCount', n)}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-center font-bold text-white text-xs py-1 outline-none"
                    />
                    <span className="text-xs text-gray-500">occurrence(s)</span>
                  </div>
                </div>
              )}

              {/* Streak Counter */}
              {isStreak && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Streak Requirement</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">After</span>
                    <NumericInput
                      value={condition.triggerCount}
                      defaultValue={2}
                      min={1}
                      max={50}
                      onChange={(n) => onUpdate(condition.id, 'triggerCount', n)}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-center font-bold text-white text-xs py-1 outline-none"
                    />
                    <span className="text-xs text-gray-500">consecutive spin(s)</span>
                  </div>
                </div>
              )}

              {/* Spin Count Target */}
              {isSpinCount && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Spin Target Milestone</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">At spin #</span>
                    <NumericInput
                      value={condition.triggerCount}
                      defaultValue={50}
                      min={1}
                      max={10000}
                      onChange={(n) => {
                        onUpdate(condition.id, 'triggerCount', n);
                        onUpdate(condition.id, 'thresholdAmount', n);
                      }}
                      className="w-20 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-center font-bold text-white text-xs py-1 outline-none"
                    />
                    <span className="text-xs text-gray-500">(or every {condition.triggerCount} spins)</span>
                  </div>
                </div>
              )}

              {/* Monetary Thresholds (Drawdown $, Bankroll Floor, Bet Size) */}
              {(isDrawdownDollar || isBankrollFloor || isBetSizeTrigger) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {isDrawdownDollar
                      ? 'Drawdown Drop Threshold'
                      : isBankrollFloor
                      ? 'Bankroll Floor Limit'
                      : 'Wager Threshold'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold text-xs">{currencySymbol}</span>
                    <NumericInput
                      value={condition.thresholdAmount}
                      defaultValue={isBankrollFloor ? 50 : 100}
                      min={0}
                      step={5}
                      allowDecimals={true}
                      placeholder={isBankrollFloor ? '50' : '100'}
                      onChange={(n) => onUpdate(condition.id, 'thresholdAmount', n)}
                      className="w-24 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-white text-xs py-1 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Percentage Thresholds (Drawdown %, Session ROI %) */}
              {(isDrawdownPercent || isSessionRoi) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {isDrawdownPercent ? 'Drawdown Percentage Threshold' : 'Session ROI Target'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <NumericInput
                      value={condition.thresholdAmount}
                      defaultValue={isDrawdownPercent ? 20 : 25}
                      min={1}
                      max={1000}
                      step={5}
                      allowDecimals={true}
                      placeholder="25"
                      onChange={(n) => onUpdate(condition.id, 'thresholdAmount', n)}
                      className="w-20 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-white text-xs py-1 outline-none"
                    />
                    <span className="text-emerald-400 font-bold text-xs">%</span>
                  </div>
                </div>
              )}

              {/* Level-based Triggers */}
              {isLevelTrigger && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {condition.trigger === 'level_reached' ? 'Exact Progression Level' : 'Progression Level (≥ L)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Level</span>
                    <NumericInput
                      value={condition.actionValue || condition.thresholdAmount || 1}
                      defaultValue={1}
                      min={1}
                      max={totalLevels || 10}
                      onChange={(n) => {
                        onUpdate(condition.id, 'actionValue', n);
                        onUpdate(condition.id, 'thresholdAmount', n);
                      }}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-center font-bold text-white text-xs py-1 outline-none"
                    />
                    <span className="text-xs text-gray-500">/ {totalLevels} total levels</span>
                  </div>
                </div>
              )}

              {/* Profit/Loss Milestone Options */}
              {isProfitLoss && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-1">
                      <CornerDownRight className="w-3 h-3 text-amber-400" />
                      <span>Comparison Type</span>
                    </div>
                    <CustomSelect<ComparisonType>
                      value={condition.comparison || 'session_profit_gte'}
                      options={COMPARISON_OPTIONS}
                      onChange={(val) => onUpdate(condition.id, 'comparison', val)}
                      size="sm"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      {condition.comparison === 'spin_profit_pct_wager' ? 'Multiplier of Wager' : 'Threshold Amount'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {condition.comparison !== 'spin_profit_pct_wager' && (
                        <span className="text-emerald-400 font-bold text-xs">{currencySymbol}</span>
                      )}
                      <NumericInput
                        value={condition.thresholdAmount}
                        defaultValue={condition.comparison === 'spin_profit_pct_wager' ? 2 : 100}
                        min={0}
                        step={condition.comparison === 'spin_profit_pct_wager' ? 0.5 : 5}
                        allowDecimals={true}
                        placeholder={condition.comparison === 'spin_profit_pct_wager' ? '2' : '100'}
                        onChange={(n) => onUpdate(condition.id, 'thresholdAmount', n)}
                        className="w-24 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-white text-xs py-1 outline-none"
                      />
                      {condition.comparison === 'spin_profit_pct_wager' && (
                        <span className="text-emerald-400 font-bold text-xs">× wager</span>
                      )}
                    </div>
                  </div>

                  {isIncremental && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Auto-Advance Step</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold text-xs">+{currencySymbol}</span>
                        <NumericInput
                          value={condition.thresholdIncrement || condition.thresholdAmount || 20}
                          defaultValue={20}
                          min={1}
                          step={5}
                          allowDecimals={true}
                          placeholder="20"
                          onChange={(n) => onUpdate(condition.id, 'thresholdIncrement', n)}
                          className="w-24 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── THEN BLOCK ── */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                THEN (Execute Action)
              </span>

              {/* Action Selector */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Action to Take</label>
                <CustomSelect<ActionType>
                  value={condition.action}
                  options={actionOptions}
                  onChange={(val) => onUpdate(condition.id, 'action', val)}
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Level Step Count (+N / -N) */}
              {isLevelStepAction && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Level Step Count</label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      value={condition.actionValue}
                      defaultValue={1}
                      min={1}
                      max={20}
                      onChange={(n) => onUpdate(condition.id, 'actionValue', n)}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                    />
                    <span className="text-xs text-gray-500">level step(s)</span>
                  </div>
                </div>
              )}

              {/* Target Level Jump / Revert (L#) */}
              {isTargetLevelJump && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {condition.action === 'goto_level' ? 'Target Level #' : 'Revert Target Level #'}
                  </label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      value={condition.actionValue}
                      defaultValue={1}
                      min={1}
                      max={totalLevels || 10}
                      onChange={(n) => onUpdate(condition.id, 'actionValue', n)}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                    />
                    <span className="text-xs text-gray-500">/ {totalLevels} total levels</span>
                  </div>
                </div>
              )}

              {/* Multiplier Additive Delta */}
              {isMultiplierDelta && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Multiplier Step (+ / −)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-bold">
                      {condition.action === 'increase_multiplier' ? '+' : '−'}
                    </span>
                    <NumericInput
                      value={condition.actionValue}
                      defaultValue={1}
                      min={1}
                      max={50}
                      onChange={(n) => onUpdate(condition.id, 'actionValue', n)}
                      className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                    />
                    <span className="text-xs text-gray-500">× multiplier</span>
                  </div>
                </div>
              )}

              {/* Multiplier Geometric Factor (multiply_by) */}
              {isMultiplierFactor && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Multiplication Factor (Scaling)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-bold">×</span>
                    <NumericInput
                      value={condition.multiplier !== undefined ? condition.multiplier : (condition.actionValue || 1.5)}
                      defaultValue={1.5}
                      min={0.1}
                      max={50}
                      step={0.5}
                      allowDecimals={true}
                      onChange={(n) => {
                        onUpdate(condition.id, 'multiplier', n);
                        onUpdate(condition.id, 'actionValue', Math.round(n));
                      }}
                      className="w-20 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                    />
                    <span className="text-xs text-gray-500">geometric factor (e.g. 1.5×, 2.0×)</span>
                  </div>
                </div>
              )}

              {/* Multiplier Set Direct (set_multiplier) */}
              {isMultiplierSet && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Exact Multiplier Target</label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      value={condition.multiplier !== undefined ? condition.multiplier : (condition.actionValue || 1.0)}
                      defaultValue={1.0}
                      min={0.1}
                      max={100}
                      step={0.5}
                      allowDecimals={true}
                      onChange={(n) => {
                        onUpdate(condition.id, 'multiplier', n);
                        onUpdate(condition.id, 'actionValue', Math.round(n));
                      }}
                      className="w-20 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                    />
                    <span className="text-xs text-gray-500">× of base wager</span>
                  </div>
                </div>
              )}

              {/* Target Level Bet Multiplier Scaling (For progression level changes) */}
              {isLevelNav && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Multiplier for Target Level</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-400 font-bold text-xs">×</span>
                      <NumericInput
                        value={condition.multiplier !== undefined ? condition.multiplier : 1.0}
                        defaultValue={1.0}
                        min={0.1}
                        max={100}
                        step={0.5}
                        allowDecimals={true}
                        onChange={(n) => onUpdate(condition.id, 'multiplier', n)}
                        className="w-16 bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 font-bold text-emerald-400 text-xs py-1 outline-none text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => onUpdate(condition.id, 'multiplierMode', 'fixed')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                          condition.multiplierMode !== 'compound'
                            ? 'bg-[#00ff87]/20 text-[#00ff87]'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdate(condition.id, 'multiplierMode', 'compound')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                          condition.multiplierMode === 'compound'
                            ? 'bg-[#00ff87]/20 text-[#00ff87]'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Compound
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* No-value action explanation */}
              {isNoValueAction && (
                <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                  {condition.action === 'reset_to_start'
                    ? 'Resets progression to Level 1 with 1.0× multiplier and clears all streaks.'
                    : condition.action === 'reset_multiplier'
                    ? 'Resets bet multiplier to 1.0× without altering current progression level.'
                    : condition.action === 'reset_streak_counters'
                    ? 'Clears consecutive win, loss, and push streaks while maintaining current level and multiplier.'
                    : condition.action === 'double_multiplier'
                    ? 'Doubles the current wager multiplier (2×).'
                    : condition.action === 'triple_multiplier'
                    ? 'Triples the current wager multiplier (3×).'
                    : condition.action === 'half_multiplier'
                    ? 'Halves the current wager multiplier (0.5×, min 1.0×).'
                    : condition.action === 'stop_simulation'
                    ? 'Immediately halts the session early to lock current balance.'
                    : 'Maintains current progression level without advancement.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Pipeline (Flat Document Flow) ───────────────────────────────────────

export const WorkflowPipeline: React.FC<WorkflowPipelineProps> = ({
  conditions,
  totalLevels,
  currencySymbol,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const [triggerOptions, setTriggerOptions] = useState<CustomSelectOption<TriggerType>[]>(TRIGGER_OPTIONS);
  const [actionOptions, setActionOptions] = useState<CustomSelectOption<ActionType>[]>(ACTION_OPTIONS);

  // Fetch dynamic community options from database on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/simulator/conditions/options')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (Array.isArray(data.triggers) && data.triggers.length > 0) {
          setTriggerOptions((prev) => {
            const existingKeys = new Set(prev.map((o) => o.value));
            const additions: CustomSelectOption<TriggerType>[] = data.triggers
              .filter((t: any) => !existingKeys.has(t.value))
              .map((t: any) => ({
                value: t.value as TriggerType,
                label: t.label,
                description: t.description || undefined,
                badge: 'DB',
              }));
            return additions.length > 0 ? [...prev, ...additions] : prev;
          });
        }
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          setActionOptions((prev) => {
            const existingKeys = new Set(prev.map((o) => o.value));
            const additions: CustomSelectOption<ActionType>[] = data.actions
              .filter((a: any) => !existingKeys.has(a.value))
              .map((a: any) => ({
                value: a.value as ActionType,
                label: a.label,
                description: a.description || undefined,
                badge: 'DB',
              }));
            return additions.length > 0 ? [...prev, ...additions] : prev;
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full">
      {conditions.length === 0 ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs text-gray-500">No automation rules configured.</p>
          <button
            type="button"
            onClick={() => onAdd()}
            className="inline-flex items-center gap-1.5 text-xs text-[#00ff87] font-semibold hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Automation Rule</span>
          </button>
        </div>
      ) : (
        <div className="space-y-0">
          {conditions.map((cond, idx) => (
            <StepNode
              key={cond.id}
              condition={cond}
              index={idx}
              totalLevels={totalLevels}
              currencySymbol={currencySymbol}
              triggerOptions={triggerOptions}
              actionOptions={actionOptions}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))}

          <div className="pt-3">
            <button
              type="button"
              onClick={() => onAdd()}
              className="inline-flex items-center gap-1.5 text-xs text-[#00ff87] font-semibold hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Rule Step</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
