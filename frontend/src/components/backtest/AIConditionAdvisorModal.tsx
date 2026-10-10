import React, { useState, useEffect } from 'react';
import { X, Brain, Check, Plus, RefreshCw, Zap } from 'lucide-react';
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

interface AIConditionAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const AIConditionAdvisorModal: React.FC<AIConditionAdvisorModalProps> = ({
  isOpen,
  onClose,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFetchSuggestions = async () => {
    if (!levels || levels.length === 0) {
      setError('Please select or configure a strategy with active placed bets first.');
      return;
    }

    setLoading(true);
    setError(null);
    setAppliedFeedback(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/simulator/ai-suggest-conditions', {
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
    setTimeout(() => {
      setAppliedFeedback(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div
        className="w-full max-w-3xl bg-[#080d0a] border border-white/15 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#090f0b]">
          <div className="flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-[#00ff87]" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">AI Condition Advisor</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Quantitative Monte Carlo &amp; AI condition generator for {strategyName || 'Active Strategy'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Controls Bar */}
        <div className="px-6 py-3 bg-[#070b08] border-b border-white/[0.08] flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="text-[11px] text-gray-400 block mb-0.5 font-medium">Optimization Focus</label>
              <select
                value={optimizationGoal}
                onChange={(e) => setOptimizationGoal(e.target.value as any)}
                className="bg-[#0e1611] border border-white/20 focus:border-[#00ff87]/60 text-xs font-semibold text-gray-200 px-2.5 py-1 rounded outline-none cursor-pointer"
              >
                <option value="max_win_rate">Maximize Win Probability</option>
                <option value="capital_preservation">Capital Preservation</option>
                <option value="balanced_growth">Balanced Growth</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-0.5 font-medium">AI Model Engine</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="bg-[#0e1611] border border-white/20 focus:border-[#00ff87]/60 text-xs font-semibold text-gray-300 px-2.5 py-1 rounded outline-none cursor-pointer"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFetchSuggestions}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00ff87] hover:bg-[#00e676] text-black font-extrabold text-xs rounded-lg transition disabled:opacity-40 cursor-pointer shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing Payouts…</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Generate Recommendations</span>
              </>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="border-l-2 border-red-500 pl-3 py-2 text-xs text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 font-bold hover:text-white ml-2">Dismiss</button>
            </div>
          )}

          {appliedFeedback && (
            <div className="border-l-2 border-[#00ff87] pl-3 py-2 text-xs font-semibold text-[#00ff87] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>{appliedFeedback}</span>
            </div>
          )}

          {!suggestion && !loading && (
            <div className="py-12 text-center space-y-2">
              <Brain className="w-10 h-10 text-gray-700 mx-auto" />
              <p className="text-sm font-semibold text-gray-300">Ready to Analyze Strategy</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Click <strong>"Generate Recommendations"</strong> to analyze your strategy’s win distribution, payout tiers, and table coverage to formulate optimal progression and stop rules.
              </p>
            </div>
          )}

          {suggestion && (
            <div className="space-y-4">
              {/* Diagnosis */}
              <div className="border-l-2 border-[#00ff87] pl-4 py-1.5 space-y-1 bg-[#00ff87]/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{suggestion.title}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-mono px-2 py-0.5 rounded bg-white/5">
                    {suggestion.archetype} · {suggestion.used_ai_model}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{suggestion.diagnosis}</p>
                {suggestion.mathematical_edge_summary && (
                  <p className="text-xs text-emerald-400/90 font-mono mt-1">
                    {suggestion.mathematical_edge_summary}
                  </p>
                )}
              </div>

              {/* Conditions List */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Recommended Automation Rules ({suggestion.suggested_conditions.length})
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-[#00ff87] hover:underline font-semibold transition cursor-pointer"
                  >
                    {selectedRuleIds.length === suggestion.suggested_conditions.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="space-y-0 divide-y divide-white/[0.06] border-y border-white/[0.08]">
                  {suggestion.suggested_conditions.map((cond: StrategyCondition, idx: number) => {
                    const isSelected = selectedRuleIds.includes(cond.id);
                    const reason = cond.reason || suggestion.condition_reasons[cond.id];

                    return (
                      <div
                        key={cond.id}
                        onClick={() => toggleRule(cond.id)}
                        className={`py-3 cursor-pointer select-none transition ${isSelected ? 'opacity-100' : 'opacity-40 hover:opacity-75'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRule(cond.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded accent-[#00ff87] cursor-pointer shrink-0"
                          />
                          <div className="flex items-center gap-2.5 flex-wrap text-xs">
                            <span className="font-mono text-gray-500 font-bold">Rule #{idx + 1}:</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold font-mono text-xs">
                              {formatTriggerDesc(cond)}
                            </span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold font-mono text-xs">
                              {formatActionDesc(cond)}
                            </span>
                          </div>
                        </div>

                        {reason && (
                          <p className="mt-1.5 pl-7 text-xs text-gray-400 leading-relaxed">
                            <span className="text-emerald-400 font-medium">Strategic Rationale:</span> {reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {suggestion.predicted_impact && (
                <div className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/30 rounded p-2.5">
                  <span className="font-bold text-white">Projected Impact: </span>
                  {suggestion.predicted_impact}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#090f0b] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer"
          >
            Close
          </button>

          {suggestion && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleApply('merge')}
                disabled={selectedRuleIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded border border-white/20 transition disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#00ff87]" />
                <span>Merge Selected ({selectedRuleIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleApply('replace')}
                disabled={selectedRuleIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00ff87] hover:bg-[#00e676] text-black font-extrabold text-xs rounded transition disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Replace Active Rules</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
