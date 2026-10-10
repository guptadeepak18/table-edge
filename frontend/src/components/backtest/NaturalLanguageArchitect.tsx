import React, { useState } from 'react';
import { ArrowRight, Loader2, Database, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProgressionLevel, GameRules } from '../../stores/simulator.store';
import type { StrategyCondition } from '../../utils/strategyEngine';

interface NaturalLanguageArchitectProps {
  rules: GameRules;
  onApplyStrategy: (data: {
    strategyName: string;
    explanation: string;
    parameters: {
      bankroll?: number;
      total_spins?: number;
      total_sessions?: number;
      stop_loss?: number;
      target_profit?: number;
    };
    levels: ProgressionLevel[];
    conditions: StrategyCondition[];
    newOptionsCreated?: Array<{ category: string; value: string; label: string }>;
  }) => void;
  onRefreshOptions?: () => void;
}

const PRESET_PROMPTS = [
  {
    title: 'Martingale on Black',
    prompt: 'Start with $10 on Black. If I lose, double the bet. Reset to base bet on any win. Starting bankroll $1000, stop loss $300, take profit $500.',
  },
  {
    title: "D'Alembert on Red",
    prompt: "Start with $20 on Red. Step up 1 level on every loss, step down 1 level on win. If session profit exceeds $150, reset to base bet.",
  },
  {
    title: 'Dozen Hedging + Split',
    prompt: 'Bet $25 on 1st Dozen and $5 on Split 14-17. If 2 consecutive losses occur, increase multiplier by 1. Reset to base on max win.',
  },
  {
    title: 'Drawdown Recovery',
    prompt: 'Bet $15 on Even. When drawdown exceeds $100, double multiplier. When new peak balance is hit, reset to base bet. Bankroll $1500.',
  },
];

export const NaturalLanguageArchitect: React.FC<NaturalLanguageArchitectProps> = ({
  rules,
  onApplyStrategy,
  onRefreshOptions,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    explanation: string;
    newOptionsCount: number;
    aiModel: string;
  } | null>(null);

  const handleGenerate = async (textToUse?: string) => {
    const text = (textToUse !== undefined ? textToUse : promptText).trim();
    if (!text) {
      setErrorMsg('Please describe a strategy or click one of the quick suggestions below.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);

    try {
      const resp = await fetch('/api/simulator/strategy/parse-natural-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          rules,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${resp.status}`);
      }

      const data = await resp.json();

      onApplyStrategy({
        strategyName: data.strategy_name || 'Natural Language Strategy',
        explanation: data.explanation || '',
        parameters: data.parameters || {},
        levels: data.levels || [],
        conditions: data.conditions || [],
        newOptionsCreated: data.new_options_created || [],
      });

      if (data.new_options_created && data.new_options_created.length > 0 && onRefreshOptions) {
        onRefreshOptions();
      }

      setSuccessInfo({
        name: data.strategy_name || 'Generated Strategy',
        explanation: data.explanation || 'Parameters, bet levels, and automation conditions have been configured.',
        newOptionsCount: data.new_options_created?.length || 0,
        aiModel: data.used_ai_model || 'Strategy Architect',
      });
    } catch (err: any) {
      console.error('[NaturalLanguageArchitect] Parse error:', err);
      setErrorMsg(err.message || 'Failed to parse natural language strategy. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Natural Language Architect
          </span>
          <p className="text-xs text-gray-500 mt-0.5">
            Describe rules or progression in plain English to auto-populate the pipeline
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition"
          aria-label={isOpen ? 'Collapse AI Architect' : 'Expand AI Architect'}
        >
          <span>{isOpen ? 'Hide Architect' : 'Open Architect'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-2.5 pt-1">
          {/* Prompt input with integrated Build button */}
          <div className="relative">
            <textarea
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Bet $15 on Red. If I lose 2 in a row, step up level. Reset to L1 on win. Starting bankroll $1000..."
              className="w-full bg-transparent border-b border-white/20 focus:border-[#00ff87]/60 py-1.5 pr-28 text-xs text-white placeholder-gray-600 outline-none transition resize-none leading-relaxed"
              disabled={isLoading}
            />

            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isLoading || !promptText.trim()}
              className="absolute right-0 bottom-2 px-3 py-1 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded border border-white/15 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Parsing…</span>
              ) : (
                <span className="text-[#00ff87]">Parse Strategy</span>
              )}
            </button>
          </div>

          {/* Quick preset suggestion links */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
            <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Presets:</span>
            {PRESET_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptText(p.prompt);
                  handleGenerate(p.prompt);
                }}
                disabled={isLoading}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition flex items-center gap-1 cursor-pointer"
              >
                <span>{p.title}</span>
                <ArrowRight className="w-2.5 h-2.5 opacity-40" />
              </button>
            ))}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="border-l-2 border-red-500 pl-3 py-1 text-xs text-red-300 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 font-bold hover:text-white ml-2">Dismiss</button>
            </div>
          )}

          {/* Success Banner */}
          {successInfo && (
            <div className="border-l-2 border-[#00ff87] pl-3 py-1 text-xs space-y-0.5">
              <div className="font-semibold text-[#00ff87]">
                ✓ {successInfo.name} Loaded
              </div>
              <p className="text-gray-400 text-[11px]">{successInfo.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
