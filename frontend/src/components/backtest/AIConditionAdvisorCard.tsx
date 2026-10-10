import React, { useState } from 'react';
import { Sparkles, Brain, Check, Plus, RefreshCw, ChevronDown, ChevronUp, ShieldCheck, Zap } from 'lucide-react';
import type { ProgressionLevel, GameRules } from '../../stores/simulator.store';
import type { StrategyCondition } from '../../utils/strategyEngine';
import { formatTriggerDesc, formatActionDesc } from '../../utils/strategyEngine';

export interface AIConditionSuggestionResult {
  title: string;
  diagnosis: string;
  mathematical_edge_summary: string;
  suggested_conditions: StrategyCondition[];
  condition_reasons: Record<string, string>;
  predicted_impact: string;
  archetype: string;
  used_ai_model: string;
}

interface Props {
  rules: GameRules;
  strategyName?: string;
  levels: ProgressionLevel[];
  bankroll: number;
  targetProfit?: number;
  stopLoss?: number;
  currentConditions: StrategyCondition[];
  onApplyConditions: (conditions: StrategyCondition[], mode: 'replace' | 'merge') => void;
  currencySymbol?: string;
}

export const AIConditionAdvisorCard: React.FC<Props> = ({
  rules,
  strategyName,
  levels,
  bankroll,
  targetProfit,
  stopLoss,
  currentConditions,
  onApplyConditions,
  currencySymbol = '$',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gpt-4o-mini' | 'nvidia-llama' | 'deepseek'>('auto');
  const [optimizationGoal, setOptimizationGoal] = useState<'max_win_rate' | 'capital_preservation' | 'balanced_growth'>('max_win_rate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AIConditionSuggestionResult | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  const modelOptions = [
    { value: 'auto', label: 'Auto (Best Active Model)' },
    { value: 'gpt-4o-mini', label: 'OpenRouter · GPT-4o-mini' },
    { value: 'nvidia-llama', label: 'NVIDIA NIM · Llama 3.2 11B' },
    { value: 'deepseek', label: 'OpenRouter · DeepSeek Chat' },
  ];

  const handleFetchSuggestions = async () => {
    if (!levels || levels.length === 0) {
      setError('Please select or configure a strategy with active placed bets first.');
      return;
    }

    setLoading(true);
    setError(null);
    setAppliedFeedback(null);
    setIsOpen(true);

    try {
      const res = await fetch('/api/simulator/ai-suggest-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: strategyName || 'Active Progression Strategy',
          rules,
          bankroll: bankroll > 0 ? bankroll : 1000.0,
          levels: levels.map((lvl) => ({
            level_number: lvl.levelNumber,
            total_wager: lvl.totalWager,
            placements: lvl.placements.map((p) => ({
              id: p.id,
              bet_type: p.betType,
              coordinate_x: p.coordinateX ?? 0,
              coordinate_y: p.coordinateY ?? 0,
              covered_pockets: p.coveredPockets,
              amount: p.amount,
              multiplier: p.multiplier,
            })),
          })),
          target_profit: targetProfit && targetProfit > 0 ? targetProfit : null,
          stop_loss: stopLoss && stopLoss > 0 ? stopLoss : null,
          existing_conditions: currentConditions.map((c) => ({
            id: c.id,
            trigger: c.trigger,
            trigger_count: c.triggerCount,
            comparison: c.comparison,
            threshold_amount: c.thresholdAmount,
            threshold_increment: c.thresholdIncrement,
            action: c.action,
            action_value: c.actionValue,
            multiplier: c.multiplier !== undefined ? c.multiplier : 1.0,
            multiplier_mode: c.multiplierMode || 'fixed',
          })),
          model_provider: selectedModel,
          optimization_goal: optimizationGoal,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI suggestion service returned HTTP ${res.status}: ${errText}`);
      }

      const data: AIConditionSuggestionResult = await res.json();
      setSuggestion(data);
      setSelectedRuleIds(data.suggested_conditions.map((c) => c.id));
    } catch (err: any) {
      console.error('Failed to get AI condition suggestions:', err);
      setError(err?.message || 'Failed to generate suggestions. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = (id: string) => {
    setSelectedRuleIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((rId: string) => rId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!suggestion) return;
    if (selectedRuleIds.length === suggestion.suggested_conditions.length) {
      setSelectedRuleIds([]);
    } else {
      setSelectedRuleIds(suggestion.suggested_conditions.map((c: StrategyCondition) => c.id));
    }
  };

  const handleApply = (mode: 'replace' | 'merge') => {
    if (!suggestion) return;
    const rulesToApply = suggestion.suggested_conditions.filter((c: StrategyCondition) =>
      selectedRuleIds.includes(c.id)
    );
    if (rulesToApply.length === 0) return;

    onApplyConditions(rulesToApply, mode);
    setAppliedFeedback(
      mode === 'replace'
        ? `Replaced active rules with ${rulesToApply.length} AI condition(s)!`
        : `Merged ${rulesToApply.length} AI condition(s) into pipeline!`
    );
    setTimeout(() => setAppliedFeedback(null), 3500);
  };

  return (
    <div className="space-y-3">
      {/* ── Section Header Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
              AI Condition Advisor
            </span>
            <span className="text-[10px] text-gray-500 font-medium">
              · {optimizationGoal === 'max_win_rate' ? 'Max Win Rate' : optimizationGoal === 'capital_preservation' ? 'Capital Guard' : 'Balanced Growth'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Suggests streak and wager scaling conditions tuned for bankroll {currencySymbol}{bankroll.toLocaleString()}
          </p>
        </div>

        {suggestion && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition"
          >
            <span>{isOpen ? 'Hide Recommendations' : 'Show Recommendations'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* ── Controls Row (Flat) ── */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <select
          value={optimizationGoal}
          onChange={(e) => setOptimizationGoal(e.target.value as any)}
          className="bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-xs font-semibold text-gray-300 py-1 outline-none cursor-pointer"
        >
          <option value="max_win_rate" className="bg-[#0a120e]">Goal: Maximize Win Probability</option>
          <option value="capital_preservation" className="bg-[#0a120e]">Goal: Capital Preservation</option>
          <option value="balanced_growth" className="bg-[#0a120e]">Goal: Balanced Growth</option>
        </select>

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as any)}
          className="bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 text-xs font-semibold text-gray-400 py-1 outline-none cursor-pointer"
        >
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#0a120e]">
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleFetchSuggestions}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded border border-white/15 transition cursor-pointer disabled:opacity-40"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Payouts…</span>
            </>
          ) : (
            <>
              <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
              <span>Suggest Conditions</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="border-l-2 border-red-500 pl-3 py-1 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold hover:text-white ml-2">Dismiss</button>
        </div>
      )}

      {/* Applied Feedback Banner */}
      {appliedFeedback && (
        <div className="border-l-2 border-[#00ff87] pl-3 py-1 text-xs font-semibold text-[#00ff87] flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{appliedFeedback}</span>
        </div>
      )}

      {/* ── Expanded Suggestions (Flat Document Flow) ── */}
      {isOpen && suggestion && (
        <div className="pt-2 space-y-3">
          {/* Diagnosis */}
          <div className="border-l-2 border-[#00ff87] pl-3 py-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-white">{suggestion.title}</span>
              <span className="text-[10px] text-gray-500 uppercase font-mono">
                {suggestion.archetype} · {suggestion.used_ai_model}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{suggestion.diagnosis}</p>
            {suggestion.mathematical_edge_summary && (
              <p className="text-[11px] text-gray-500 mt-1 font-mono">
                {suggestion.mathematical_edge_summary}
              </p>
            )}
          </div>

          {/* Condition Items List */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Recommended Rules ({suggestion.suggested_conditions.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[11px] text-gray-500 hover:text-gray-300 font-semibold transition"
              >
                {selectedRuleIds.length === suggestion.suggested_conditions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-0 divide-y divide-white/[0.05]">
              {suggestion.suggested_conditions.map((cond: StrategyCondition, idx: number) => {
                const isSelected = selectedRuleIds.includes(cond.id);
                const reason = cond.reason || suggestion.condition_reasons[cond.id];

                return (
                  <div
                    key={cond.id}
                    onClick={() => toggleRule(cond.id)}
                    className={`py-2.5 cursor-pointer select-none transition ${isSelected ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRule(cond.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded accent-[#00ff87] cursor-pointer shrink-0"
                      />
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono text-gray-500 font-bold">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold font-mono text-[11px]">
                          {formatTriggerDesc(cond)}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold font-mono text-[11px]">
                          {formatActionDesc(cond)}
                        </span>
                      </div>
                    </div>

                    {reason && (
                      <p className="mt-1 pl-6 text-xs text-gray-500 leading-relaxed">
                        <span className="text-emerald-500 font-medium">Edge:</span> {reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact + Actions */}
          {suggestion.predicted_impact && (
            <div className="text-xs text-emerald-400/80">
              <span className="text-gray-500">Projected Impact: </span>{suggestion.predicted_impact}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleApply('merge')}
              disabled={selectedRuleIds.length === 0}
              className="text-xs text-[#00ff87] font-semibold hover:underline disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              + Merge Selected ({selectedRuleIds.length})
            </button>
            <span className="text-gray-700">·</span>
            <button
              type="button"
              onClick={() => handleApply('replace')}
              disabled={selectedRuleIds.length === 0}
              className="px-3 py-1 bg-[#00ff87] hover:bg-[#00e676] text-black font-extrabold text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Replace Active Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
