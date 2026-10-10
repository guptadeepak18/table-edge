import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import type { ProgressionLevel, GameRules } from '../../stores/simulator.store';
import type { StrategyCondition } from '../../utils/strategyEngine';

interface NaturalLanguageArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const NaturalLanguageArchitectModal: React.FC<NaturalLanguageArchitectModalProps> = ({
  isOpen,
  onClose,
  rules,
  onApplyStrategy,
  onRefreshOptions,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    explanation: string;
    newOptionsCount: number;
    aiModel: string;
  } | null>(null);

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
      const resp = await fetch('http://127.0.0.1:8000/api/simulator/strategy/parse-natural-language', {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-[#080d0a] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#090f0b]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#00ff87]" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">AI Strategy Architect</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Describe your betting system in plain English to auto-populate parameters and rules
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

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Strategy Description
            </label>
            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Start with $15 on Red and $5 on 2nd Dozen. If I lose 2 in a row, step up 1 level. Reset to L1 on win. Starting bankroll $1000, stop loss $300, take profit $400..."
              className="w-full bg-[#050806] border border-white/20 focus:border-[#00ff87]/70 rounded-lg p-3 text-xs text-white placeholder-gray-500 outline-none transition resize-none leading-relaxed"
              disabled={isLoading}
            />
          </div>

          {/* Quick Prompts */}
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Or Try A Preset Template:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPromptText(p.prompt);
                    handleGenerate(p.prompt);
                  }}
                  disabled={isLoading}
                  className="text-left p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#00ff87]/40 rounded-lg transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200 group-hover:text-[#00ff87]">{p.title}</span>
                    <ArrowRight className="w-3 h-3 text-gray-500 group-hover:text-[#00ff87] transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-2 mt-1 leading-snug">{p.prompt}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="border-l-2 border-red-500 pl-3 py-1.5 text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 font-bold hover:text-white ml-2">Dismiss</button>
            </div>
          )}

          {/* Success Banner */}
          {successInfo && (
            <div className="border-l-2 border-[#00ff87] pl-3 py-2 text-xs space-y-1 bg-[#00ff87]/[0.04]">
              <div className="font-bold text-[#00ff87]">
                ✓ {successInfo.name} Loaded
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{successInfo.explanation}</p>
              <div className="text-[11px] text-gray-500 font-mono">
                Model: {successInfo.aiModel}
              </div>
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
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isLoading || !promptText.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#00ff87] hover:bg-[#00e676] text-black font-extrabold text-xs rounded-lg transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Parsing Strategy…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse &amp; Apply Strategy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
