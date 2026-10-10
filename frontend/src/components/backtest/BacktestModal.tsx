import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSimulatorStore, type ProgressionLevel } from '../../stores/simulator.store';
import {
  X,
  Plus,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Activity,
  Check,
  Zap,
  ChevronDown,
  Download,
  Search,
  Info,
  Layers,
  Maximize2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  type StrategyCondition,
  type AdvancedBacktestResult,
  type BacktestHistoryPoint,
  type SessionRecord,
  executeAdvancedSimulation,
  inspectLevelOutcomes,
  PRESET_STRATEGY_CONDITIONS,
  formatTriggerDesc,
  formatActionDesc,
} from '../../utils/strategyEngine';
import { ConditionRuleCard } from './ConditionRuleCard';
import { AIConditionAdvisorCard } from './AIConditionAdvisorCard';
import { CustomSelect, type CustomSelectOption } from '../common/CustomSelect';

interface BacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStudio?: () => void;
}

const INPUT =
  'bg-[#0d1410] border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white font-medium outline-none focus:border-emerald-500 w-full';

export const BacktestModal: React.FC<BacktestModalProps> = ({ isOpen, onClose, onOpenStudio }) => {
  const { savedLevels, strategies, rules, currency } = useSimulatorStore();

  // All blank by default
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [bankroll, setBankroll] = useState<string>('');
  const [totalSessions, setTotalSessions] = useState<string>('');
  const [totalSpins, setTotalSpins] = useState<string>('');
  const [targetProfit, setTargetProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [conditions, setConditions] = useState<StrategyCondition[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationStage, setSimulationStage] = useState<string>('Initializing Monte Carlo Models...');
  const [simulatedSpinsCount, setSimulatedSpinsCount] = useState<number>(0);
  const [selectedAdvisorRules, setSelectedAdvisorRules] = useState<string[]>([]);

  const [results, setResults] = useState<AdvancedBacktestResult | null>(null);
  const [inspectedSessionIndex, setInspectedSessionIndex] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BacktestHistoryPoint | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'sessions' | 'spins' | 'levels' | 'rules' | 'advisor'>('spins');
  const [spinFilter, setSpinFilter] = useState<'all' | 'rules' | 'wins' | 'losses'>('all');
  const [spinSearch, setSpinSearch] = useState<string>('');
  const [highlightConditions, setHighlightConditions] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showOutcomeGuide, setShowOutcomeGuide] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close presets dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedStrategy = useMemo(() => {
    if (!selectedStrategyId) return null;
    if (selectedStrategyId === '__active__') {
      const valid = savedLevels.filter((l) => l.placements.length > 0);
      return { id: '__active__', name: 'Active Felt Progression', levels: valid.length > 0 ? valid : savedLevels };
    }
    return strategies.find((s) => s.id === selectedStrategyId) || null;
  }, [selectedStrategyId, savedLevels, strategies]);

  const activeLevels: ProgressionLevel[] = useMemo(() => {
    if (!selectedStrategy) return [];
    return selectedStrategy.levels.filter((l) => l.placements && l.placements.length > 0);
  }, [selectedStrategy]);

  const levelOneWager = useMemo(() => {
    if (!activeLevels || activeLevels.length === 0) return 0;
    const l1 = activeLevels[0];
    return Number(l1.totalWager) || l1.placements.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [activeLevels]);

  const outcomeInfo = useMemo(() => {
    if (!activeLevels || activeLevels.length === 0) return null;
    return inspectLevelOutcomes(activeLevels[0], rules);
  }, [activeLevels, rules]);

  const strategySelectOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [];
    if (savedLevels && savedLevels.length > 0) {
      opts.push({ value: '__active__', label: 'Active Felt Progression', description: `${savedLevels.length} progression level(s) on felt`, badge: 'LIVE' });
    }
    strategies.forEach((strat) => {
      opts.push({ value: strat.id, label: strat.name, description: `${strat.levels?.length || 0} progression level(s)` });
    });
    return opts;
  }, [savedLevels, strategies]);

  const getPocketBadgeClass = (pocket?: number | string) => {
    if (pocket === undefined || pocket === '-') return 'bg-white/10 text-gray-400';
    const str = String(pocket);
    if (str === '0' || str === '00') return 'bg-emerald-600 text-white font-bold';
    const redPockets = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const num = parseInt(str, 10);
    if (!isNaN(num) && redPockets.includes(num)) return 'bg-red-600 text-white font-bold';
    return 'bg-zinc-800 text-white font-bold border border-white/20';
  };

  const inspectedSession: SessionRecord | null = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    return results.sessions.find((s) => s.sessionIndex === inspectedSessionIndex) || results.sessions[0];
  }, [results, inspectedSessionIndex]);

  const activeHistory: BacktestHistoryPoint[] = useMemo(() => {
    if (!results) return [];
    if (results.totalSessions === 1) return results.history;
    if (inspectedSession?.history && inspectedSession.history.length > 0) {
      return inspectedSession.history;
    }
    return results.history;
  }, [results, inspectedSession]);

  const bestSession = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    return results.sessions.reduce((prev, curr) => (curr.netProfit > prev.netProfit ? curr : prev), results.sessions[0]);
  }, [results]);

  const worstSession = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    return results.sessions.reduce((prev, curr) => (curr.netProfit < prev.netProfit ? curr : prev), results.sessions[0]);
  }, [results]);

  const handleExportSessionsCSV = () => {
    if (!results || !results.sessions || results.sessions.length === 0) return;
    const headers = [
      'Session #',
      'Completed Spins',
      'Exit Reason',
      'Initial Bankroll',
      'Final Bankroll',
      'Net Profit',
      'ROI %',
      'Peak Bankroll',
      'Lowest Bankroll',
      'Max Drawdown',
      'Total Wins',
      'Total Losses',
      'Pushes',
    ];

    const rows = results.sessions.map((s) => [
      s.sessionIndex,
      s.completedSpins,
      `"${(s.stopReason || 'Completed Max Spins').replace(/"/g, '""')}"`,
      s.initialBankroll.toFixed(2),
      s.finalBankroll.toFixed(2),
      s.netProfit.toFixed(2),
      s.roiPercent.toFixed(2),
      s.peakBankroll.toFixed(2),
      s.lowestBankroll.toFixed(2),
      s.maxDrawdown.toFixed(2),
      s.totalWins,
      s.totalLosses,
      s.pushes,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const stratName = (selectedStrategy?.name || 'strategy').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    link.setAttribute('download', `table_edge_sessions_summary_${stratName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!results || activeHistory.length <= 1) return;
    const sNum = results.totalSessions > 1 ? (inspectedSession?.sessionIndex || 1) : 1;
    const headers = [
      'Session',
      'Spin',
      'Level',
      'Multiplier',
      'Wager',
      'Pocket Rolled',
      'Outcome',
      'Payout',
      'Net Win',
      'Bankroll',
      'Cumulative Profit',
      'Condition Triggered',
      'Action Taken',
      'Next Level',
      'Next Multiplier',
    ];

    const rows = activeHistory.slice(1).map((pt) => [
      `Session #${sNum}`,
      pt.spin,
      `L${pt.level}`,
      `${pt.multiplier}x`,
      pt.wager.toFixed(2),
      pt.pocket !== undefined ? String(pt.pocket) : '-',
      pt.outcome.replace('_', ' ').toUpperCase(),
      pt.payout.toFixed(2),
      pt.netWin.toFixed(2),
      pt.balance.toFixed(2),
      pt.cumulativeProfit.toFixed(2),
      `"${(pt.conditionApplied || 'None').replace(/"/g, '""')}"`,
      `"${(pt.actionTaken || 'None').replace(/"/g, '""')}"`,
      `L${pt.nextLevel}`,
      `${pt.nextMultiplier}x`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const stratName = (selectedStrategy?.name || 'strategy').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    link.setAttribute('download', `table_edge_spin_history_${stratName}_session${sNum}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredHistory = useMemo(() => {
    if (!results) return [];
    return activeHistory.slice(1).filter((pt) => {
      if (spinFilter === 'rules' && !pt.conditionApplied) return false;
      if (spinFilter === 'wins' && pt.netWin <= 0) return false;
      if (spinFilter === 'losses' && pt.netWin >= 0) return false;
      if (spinSearch) {
        const q = spinSearch.toLowerCase();
        const matchPocket = String(pt.pocket).toLowerCase().includes(q);
        const matchRule = pt.conditionApplied?.toLowerCase().includes(q);
        const matchAction = pt.actionTaken?.toLowerCase().includes(q);
        const matchOutcome = pt.outcome.toLowerCase().includes(q);
        if (!matchPocket && !matchRule && !matchAction && !matchOutcome) return false;
      }
      return true;
    });
  }, [results, activeHistory, spinFilter, spinSearch]);

  const handleAddCondition = (initial?: Partial<StrategyCondition>) => {
    const id = `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newCond: StrategyCondition = {
      id,
      trigger: initial?.trigger || 'total_loss',
      triggerCount: initial?.triggerCount !== undefined ? initial.triggerCount : 1,
      comparison: initial?.comparison || 'session_profit_gte',
      thresholdAmount: initial?.thresholdAmount !== undefined ? initial.thresholdAmount : 100,
      thresholdIncrement: initial?.thresholdIncrement,
      action: initial?.action || 'increase_level',
      actionValue: initial?.actionValue !== undefined ? initial.actionValue : 1,
      multiplier: initial?.multiplier !== undefined ? initial.multiplier : 1.0,
      multiplierMode: initial?.multiplierMode || 'fixed',
    };
    setConditions((prev) => [...prev, newCond]);
  };

  const handleUpdateCondition = (id: string, field: keyof StrategyCondition, value: any) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };
        if (field === 'trigger' && value === 'profit_loss' && !updated.comparison) {
          updated.comparison = 'session_profit_gte';
          updated.thresholdAmount = 100;
        }
        return updated;
      })
    );
  };

  const handleRemoveCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDuplicateCondition = (cond: StrategyCondition) => {
    handleAddCondition({ ...cond });
  };

  const handleClearConditions = () => { setConditions([]); };

  const handleApplyPreset = (presetName: string) => {
    const preset = PRESET_STRATEGY_CONDITIONS.find((p) => p.name === presetName);
    if (!preset) return;
    const cloned = preset.conditions.map((c, idx) => ({ ...c, id: `preset-${idx}-${Date.now()}` }));
    setConditions(cloned);
    setShowPresets(false);
  };

  const handleResetAll = () => {
    setSelectedStrategyId(''); setBankroll(''); setTotalSessions('1'); setTotalSpins('');
    setTargetProfit(''); setStopLoss(''); setConditions([]);
    setResults(null); setErrorMessage(null); setHoveredPoint(null); setInspectedSessionIndex(1);
    setActiveAnalysisTab('spins');
  };

  // Staged Monte Carlo Simulation Handler (1.2s–1.4s calculation animation)
  const handleRunSimulation = async () => {
    setErrorMessage(null);
    if (!selectedStrategyId) { setErrorMessage('Please select a strategy to test.'); return; }
    if (activeLevels.length === 0) { setErrorMessage('Selected strategy has no active progression levels with bets placed.'); return; }
    const bankrollNum = parseFloat(bankroll);
    if (!bankroll || isNaN(bankrollNum) || bankrollNum <= 0) { setErrorMessage('Please enter a valid positive Starting Bankroll.'); return; }
    const spinsNum = parseInt(totalSpins, 10);
    if (!totalSpins || isNaN(spinsNum) || spinsNum <= 0) { setErrorMessage('Please enter a valid Number of Spins (>= 1).'); return; }
    const sessionsNum = parseInt(totalSessions, 10);
    const validSessions = !isNaN(sessionsNum) && sessionsNum >= 1 ? sessionsNum : 1;
    const stopLossNum = stopLoss ? parseFloat(stopLoss) : undefined;
    const targetProfitNum = targetProfit ? parseFloat(targetProfit) : undefined;

    setIsRunning(true);
    setHoveredPoint(null);
    setInspectedSessionIndex(1);
    setSimulationProgress(8);
    setSimulationStage('Compiling progression models & seeding crypto PRNG...');
    setSimulatedSpinsCount(0);

    const totalTargetSpins = spinsNum * validSessions;

    // Stage 1 (0ms - 280ms)
    await new Promise((r) => setTimeout(r, 260));
    setSimulationProgress(32);
    setSimulationStage('Calibrating rule triggers & table payout matrices...');
    setSimulatedSpinsCount(Math.round(totalTargetSpins * 0.22));

    // Stage 2 (280ms - 620ms)
    await new Promise((r) => setTimeout(r, 340));
    setSimulationProgress(68);
    setSimulationStage(`Evaluating ${totalTargetSpins.toLocaleString()} Monte Carlo trajectories...`);
    setSimulatedSpinsCount(Math.round(totalTargetSpins * 0.70));

    // Stage 3 (620ms - 960ms)
    await new Promise((r) => setTimeout(r, 340));
    setSimulationProgress(90);
    setSimulationStage('Calculating risk corridors & drawdown boundaries...');
    setSimulatedSpinsCount(totalTargetSpins);

    // Stage 4 (960ms - 1240ms)
    await new Promise((r) => setTimeout(r, 280));
    setSimulationProgress(100);
    setSimulationStage('Synthesizing statistical telemetry & AI diagnostics...');

    await new Promise((r) => setTimeout(r, 120));

    try {
      const simResult = executeAdvancedSimulation({
        initialBankroll: bankrollNum,
        totalSpins: spinsNum,
        totalSessions: validSessions,
        rules,
        levels: activeLevels,
        stopLoss: stopLossNum,
        targetProfit: targetProfitNum,
        conditions,
      });
      setResults(simResult);
      if (simResult.aiSuggestions?.suggestedConditions) {
        setSelectedAdvisorRules(simResult.aiSuggestions.suggestedConditions.map((c) => c.id));
      }
      if (validSessions > 1) {
        setActiveAnalysisTab('sessions');
      } else {
        setActiveAnalysisTab('spins');
      }
      fetch('http://127.0.0.1:8000/api/simulator/backtest/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_bankroll: bankrollNum,
          total_spins: spinsNum,
          total_sessions: validSessions,
          rules,
          levels: activeLevels,
          stop_loss: stopLossNum,
          target_profit: targetProfitNum,
          conditions: conditions.map((c) => ({
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
        }),
      }).catch(() => {});
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error occurred during simulation.');
    } finally {
      setIsRunning(false);
    }
  };

  // AI Advisor Selection & Application Handlers
  const handleToggleAdvisorRule = (id: string) => {
    setSelectedAdvisorRules((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  const handleSelectAllAdvisorRules = () => {
    if (!results?.aiSuggestions?.suggestedConditions) return;
    const allIds = results.aiSuggestions.suggestedConditions.map((c) => c.id);
    setSelectedAdvisorRules((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const handleMergeAISuggestions = () => {
    if (!results?.aiSuggestions?.suggestedConditions) return;
    const selected = results.aiSuggestions.suggestedConditions.filter((c) =>
      selectedAdvisorRules.includes(c.id)
    );
    if (selected.length === 0) return;
    setConditions((prev) => {
      const existingSignatures = new Set(prev.map((c) => `${c.trigger}_${c.action}_${c.comparison || ''}`));
      const newItems = selected
        .filter((r) => !existingSignatures.has(`${r.trigger}_${r.action}_${r.comparison || ''}`))
        .map((r) => ({ ...r, id: `advisor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` }));
      return [...prev, ...newItems];
    });
    setHighlightConditions(true);
    setTimeout(() => setHighlightConditions(false), 2000);
  };

  const handleReplaceAISuggestions = () => {
    if (!results?.aiSuggestions?.suggestedConditions) return;
    const selected = results.aiSuggestions.suggestedConditions.filter((c) =>
      selectedAdvisorRules.includes(c.id)
    );
    if (selected.length === 0) return;
    const cloned = selected.map((r) => ({
      ...r,
      id: `advisor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    }));
    setConditions(cloned);
    setHighlightConditions(true);
    setTimeout(() => setHighlightConditions(false), 2000);
  };

  const handleApplyAIConditions = (newConds: StrategyCondition[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setConditions(newConds);
    } else {
      setConditions((prev) => {
        const existingSignatures = new Set(prev.map((c) => `${c.trigger}_${c.action}_${c.comparison || ''}`));
        const filtered = newConds.filter((r) => !existingSignatures.has(`${r.trigger}_${r.action}_${r.comparison || ''}`));
        return [...prev, ...filtered];
      });
    }
    setHighlightConditions(true);
    setTimeout(() => setHighlightConditions(false), 2000);
  };

  // ─── Canvas chart: Single vs Multi-Session rendering ───
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (!results) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Configure strategy and run simulation to see balance trajectory', w / 2, h / 2);
      return;
    }

    const initialBankroll = results.initialBankroll;
    const isMulti = results.totalSessions > 1;
    const GREEN = '#00ff87';
    const RED = '#ff3b30';
    const padY = 24;
    const padX = 8;

    if (!isMulti) {
      // ─── Single-Session Mode: Exact polygon fill + clipped line ───
      const history = results.history;
      if (history.length === 0) return;
      const balances = history.map((p) => p.balance);
      const minBalance = Math.min(...balances, initialBankroll);
      const maxBalance = Math.max(...balances, initialBankroll);
      const range = maxBalance - minBalance || 1;

      const getY = (val: number) => h - padY - ((val - minBalance) / range) * (h - padY * 2);
      const getX = (idx: number) => padX + (idx / (history.length - 1 || 1)) * (w - padX * 2);

      const startY = getY(initialBankroll);

      // Starting balance reference line
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.moveTo(padX, startY);
      ctx.lineTo(w - padX, startY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${currency.symbol}${initialBankroll.toLocaleString()}`, padX + 6, startY - 3);

      const buildLinePath = () => {
        const path = new Path2D();
        history.forEach((pt, idx) => {
          const x = getX(idx);
          const y = getY(pt.balance);
          if (idx === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        return path;
      };

      const buildFillPath = () => {
        const path = new Path2D();
        history.forEach((pt, idx) => {
          const x = getX(idx);
          const y = getY(pt.balance);
          if (idx === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        path.lineTo(getX(history.length - 1), h - padY);
        path.lineTo(getX(0), h - padY);
        path.closePath();
        return path;
      };

      // Fill — profit zone (above startY)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, startY);
      ctx.clip();
      const profitGrad = ctx.createLinearGradient(0, 0, 0, startY);
      profitGrad.addColorStop(0, 'rgba(0,255,135,0.22)');
      profitGrad.addColorStop(1, 'rgba(0,255,135,0.0)');
      ctx.fillStyle = profitGrad;
      ctx.fill(buildFillPath());
      ctx.restore();

      // Fill — loss zone (below startY)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, startY, w, h - startY);
      ctx.clip();
      const lossGrad = ctx.createLinearGradient(0, startY, 0, h);
      lossGrad.addColorStop(0, 'rgba(255,59,48,0.0)');
      lossGrad.addColorStop(1, 'rgba(255,59,48,0.22)');
      ctx.fillStyle = lossGrad;
      ctx.fill(buildFillPath());
      ctx.restore();

      // Line — profit zone (above startY) in green
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, startY + 1);
      ctx.clip();
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 2;
      ctx.shadowColor = GREEN;
      ctx.shadowBlur = 6;
      ctx.stroke(buildLinePath());
      ctx.shadowBlur = 0;
      ctx.restore();

      // Line — loss zone (below startY) in red
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, startY - 1, w, h - startY + 1);
      ctx.clip();
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.shadowColor = RED;
      ctx.shadowBlur = 6;
      ctx.stroke(buildLinePath());
      ctx.shadowBlur = 0;
      ctx.restore();

      // Hover crosshair & dot
      if (hoveredPoint) {
        const hx = getX(hoveredPoint.spin);
        const hy = getY(hoveredPoint.balance);
        const isProfit = hoveredPoint.balance >= initialBankroll;
        const dotColor = isProfit ? GREEN : RED;

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.moveTo(hx, padY);
        ctx.lineTo(hx, h - padY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor;
        ctx.shadowBlur = 12;
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // ─── Multi-Session Mode: Spaghetti Envelope & Highlighted Inspected Session ───
      const sessions = results.sessions || [];
      const globalMin = Math.min(results.lowestBankroll, initialBankroll);
      const globalMax = Math.max(results.peakBankroll, initialBankroll);
      const range = globalMax - globalMin || 1;

      const getY = (val: number) => h - padY - ((val - globalMin) / range) * (h - padY * 2);
      const maxSpins = results.totalSpins;
      const getX = (spinIdx: number, sLen: number) => padX + (spinIdx / Math.max(maxSpins, sLen - 1 || 1)) * (w - padX * 2);

      const startY = getY(initialBankroll);

      // Starting Balance Line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.moveTo(padX, startY);
      ctx.lineTo(w - padX, startY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Start: ${currency.symbol}${initialBankroll.toLocaleString()}`, padX + 6, startY - 3);

      // Target Profit boundary line if defined
      const targetProfitNum = targetProfit ? parseFloat(targetProfit) : undefined;
      if (targetProfitNum && targetProfitNum > 0) {
        const tpY = getY(initialBankroll + targetProfitNum);
        if (tpY >= 0 && tpY <= h) {
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(0,255,135,0.5)';
          ctx.lineWidth = 1;
          ctx.moveTo(padX, tpY);
          ctx.lineTo(w - padX, tpY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(0,255,135,0.7)';
          ctx.fillText(`Target: +${currency.symbol}${targetProfitNum}`, w - 100, tpY - 3);
        }
      }

      // Stop Loss boundary line if defined
      const stopLossNum = stopLoss ? parseFloat(stopLoss) : undefined;
      if (stopLossNum && stopLossNum > 0) {
        const slY = getY(initialBankroll - stopLossNum);
        if (slY >= 0 && slY <= h) {
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(255,59,48,0.5)';
          ctx.lineWidth = 1;
          ctx.moveTo(padX, slY);
          ctx.lineTo(w - padX, slY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,59,48,0.7)';
          ctx.fillText(`Stop Loss: -${currency.symbol}${stopLossNum}`, w - 110, slY - 3);
        }
      }

      // Draw all sessions as background curves
      sessions.forEach((s) => {
        if (s.sessionIndex === inspectedSessionIndex) return; // Draw inspected on top later
        const traj = s.balanceTrajectory;
        if (!traj || traj.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = s.netProfit > 0 ? 'rgba(0, 255, 135, 0.12)' : s.netProfit < 0 ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        traj.forEach((val, idx) => {
          const x = getX(idx, traj.length);
          const y = getY(val);
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });

      // Highlight the Currently Inspected Session
      const inspected = sessions.find((s) => s.sessionIndex === inspectedSessionIndex) || sessions[0];
      if (inspected && inspected.balanceTrajectory && inspected.balanceTrajectory.length > 0) {
        const traj = inspected.balanceTrajectory;
        ctx.beginPath();
        const strokeCol = inspected.netProfit >= 0 ? GREEN : RED;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = strokeCol;
        ctx.shadowBlur = 8;
        traj.forEach((val, idx) => {
          const x = getX(idx, traj.length);
          const y = getY(val);
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw hover point on inspected session
        if (hoveredPoint) {
          const ptSpin = hoveredPoint.spin;
          const ptVal = hoveredPoint.balance;
          const hx = getX(ptSpin, traj.length);
          const hy = getY(ptVal);

          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          ctx.moveTo(hx, padY);
          ctx.lineTo(hx, h - padY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.fillStyle = ptVal >= initialBankroll ? GREEN : RED;
          ctx.shadowColor = ptVal >= initialBankroll ? GREEN : RED;
          ctx.shadowBlur = 12;
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }, [results, hoveredPoint, inspectedSessionIndex, targetProfit, stopLoss, currency.symbol]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!results || !canvasRef.current) return;
    const hist = activeHistory;
    if (hist.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padX = 8;
    const clampedX = Math.max(padX, Math.min(rect.width - padX, mouseX));
    const pct = (clampedX - padX) / (rect.width - padX * 2);
    const index = Math.round(pct * (hist.length - 1));
    if (hist[index]) setHoveredPoint(hist[index]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4">
      <div className="relative w-full max-w-[1340px] h-[92vh] max-h-[860px] bg-[#070c09] border border-white/12 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff87] shadow-[0_0_8px_#00ff87]" />
            <h3 className="text-base font-bold tracking-wide text-white">Test Strategy Engine</h3>
            <span className="text-xs text-gray-500 hidden sm:inline">— Progression Simulation & Expectancy Analytics</span>
          </div>
          <div className="flex items-center gap-4">
            {results && (
              <span className="text-sm text-gray-400">
                {results.totalSessions > 1 ? (
                  <>
                    Sessions: <strong className="text-white">{results.totalSessions}</strong>
                    <span className="mx-2 text-white/20">|</span>
                    Spins/Sess: <strong className="text-white">{results.totalSpins}</strong>
                    <span className="mx-2 text-white/20">|</span>
                    Win Rate: <strong className={results.sessionWinRate >= 50 ? 'text-[#00ff87]' : 'text-amber-400'}>{results.sessionWinRate}%</strong>
                  </>
                ) : (
                  <>
                    Spins: <strong className="text-white">{results.completedSpins}</strong>/{results.totalSpins}
                    {results.stoppedEarly && <span className="ml-2 text-amber-400 font-semibold">[{results.stopReason}]</span>}
                  </>
                )}
              </span>
            )}
            {onOpenStudio && (
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 hover:bg-emerald-900/60 text-[#00ff87] font-bold text-xs rounded-lg transition cursor-pointer"
                title="Open in dedicated full-page Strategy Studio"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Studio</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer" title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {errorMessage && (
          <div className="mx-5 mt-3 px-4 py-2 bg-red-950/40 border border-red-500/40 rounded-lg flex items-center gap-2 text-red-200 text-sm shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Body: 2 columns ── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">

          {/* ════════════════ LEFT COLUMN ════════════════ */}
          <div className="flex flex-col min-h-0 px-5 py-4 border-r border-white/10 overflow-hidden">

            {/* ── Section: Configuration ── */}
            <div className="shrink-0 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</p>
              <div className="space-y-3">

                {/* Strategy */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Strategy</label>
                  <CustomSelect
                    value={selectedStrategyId}
                    options={strategySelectOptions}
                    onChange={(val) => { setSelectedStrategyId(String(val)); setResults(null); setErrorMessage(null); }}
                    placeholder="— Choose a strategy —"
                  />
                  {selectedStrategy && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-emerald-400">
                          {activeLevels.length} active levels · Base: {currency.symbol}{levelOneWager.toLocaleString()}
                        </p>
                        {outcomeInfo && (
                          <button
                            type="button"
                            onClick={() => setShowOutcomeGuide((v) => !v)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                            {showOutcomeGuide ? 'Hide Payout Guide' : 'Outcome & Payout Guide'}
                          </button>
                        )}
                      </div>

                      {/* Uniform payout banner notice if applicable */}
                      {outcomeInfo && outcomeInfo.isUniformPayout && !showOutcomeGuide && (
                        <div className="text-[11px] leading-snug bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 text-amber-300">
                          <span className="font-semibold">Uniform Payout Strategy:</span> All {outcomeInfo.maxWinPockets.length} winning numbers pay {currency.symbol}{outcomeInfo.maxWinPayout.toFixed(0)} (+{currency.symbol}{outcomeInfo.maxWinNet.toFixed(0)}). Winning spins count as <span className="underline font-semibold">Max Wins</span> (0 partial wins). Use <span className="text-white font-bold">'Any Win'</span> to trigger on all wins.
                        </div>
                      )}

                      {/* Detailed Outcome Guide Accordion */}
                      {outcomeInfo && showOutcomeGuide && (
                        <div className="bg-[#080d0a] border border-cyan-500/30 rounded-xl p-3 text-xs space-y-2 max-h-52 overflow-y-auto">
                          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-cyan-400" />
                              Level 1 Felt Outcome Breakdown ({rules} Roulette)
                            </span>
                            <span className="text-[10px] text-gray-400">Base Bet: {currency.symbol}{outcomeInfo.totalWager}</span>
                          </div>

                          {outcomeInfo.isUniformPayout ? (
                            <p className="text-[11px] text-amber-300/90 leading-relaxed">
                              All {outcomeInfo.maxWinPockets.length} winning numbers on this felt return the exact same payout of {currency.symbol}{outcomeInfo.maxWinPayout.toFixed(0)} (+{currency.symbol}{outcomeInfo.maxWinNet.toFixed(0)} net). Because all wins pay the max tier, <strong>0 Partial Wins occur</strong>. When creating rules, select <strong>"Any Win"</strong> or <strong>"Max Win"</strong> to trigger on wins.
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                              This layout has multiple payout tiers. The engine classifies each spin based on its net return relative to your total wager.
                            </p>
                          )}

                          <div className="grid grid-cols-1 gap-1.5 pt-1 font-mono text-[11px]">
                            {/* Max Win */}
                            <div className="flex items-start justify-between bg-emerald-950/30 border border-emerald-500/20 rounded px-2 py-1 text-emerald-300">
                              <div>
                                <span className="font-bold text-emerald-400">🟢 Max Win</span>
                                <span className="text-[10px] text-gray-400 ml-1.5">({outcomeInfo.maxWinPockets.length} pockets)</span>
                                <div className="text-[10px] text-gray-300 mt-0.5 font-sans break-words max-w-[280px]">
                                  {outcomeInfo.maxWinPockets.slice(0, 18).join(', ')}{outcomeInfo.maxWinPockets.length > 18 ? ` +${outcomeInfo.maxWinPockets.length - 18} more` : ''}
                                </div>
                              </div>
                              <span className="font-bold text-emerald-400 shrink-0">+{currency.symbol}{outcomeInfo.maxWinNet.toFixed(0)}</span>
                            </div>

                            {/* Partial Win */}
                            <div className="flex items-start justify-between bg-blue-950/30 border border-blue-500/20 rounded px-2 py-1 text-blue-300">
                              <div>
                                <span className="font-bold text-blue-400">🔵 Partial Win</span>
                                <span className="text-[10px] text-gray-400 ml-1.5">({outcomeInfo.partialWinPockets.length} pockets)</span>
                                {outcomeInfo.partialWinPockets.length > 0 ? (
                                  <div className="text-[10px] text-gray-300 mt-0.5 font-sans break-words max-w-[280px]">
                                    {outcomeInfo.partialWinPockets.slice(0, 18).join(', ')}{outcomeInfo.partialWinPockets.length > 18 ? ` +${outcomeInfo.partialWinPockets.length - 18} more` : ''}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-gray-500 mt-0.5 font-sans italic">None on this layout</div>
                                )}
                              </div>
                              <span className="font-bold text-blue-400 shrink-0">
                                {outcomeInfo.partialWinPockets.length > 0
                                  ? (outcomeInfo.partialWinMinNet === outcomeInfo.partialWinMaxNet
                                      ? `+${currency.symbol}${outcomeInfo.partialWinMinNet.toFixed(2)}`
                                      : `+${currency.symbol}${outcomeInfo.partialWinMinNet.toFixed(2)} ~ +${currency.symbol}${outcomeInfo.partialWinMaxNet.toFixed(2)}`)
                                  : '—'}
                              </span>
                            </div>

                            {/* Push */}
                            {outcomeInfo.pushPockets.length > 0 && (
                              <div className="flex items-start justify-between bg-zinc-900/60 border border-white/10 rounded px-2 py-1 text-gray-300">
                                <div>
                                  <span className="font-bold text-gray-300">⚪ Push / Breakeven</span>
                                  <span className="text-[10px] text-gray-400 ml-1.5">({outcomeInfo.pushPockets.length} pockets)</span>
                                  <div className="text-[10px] text-gray-400 mt-0.5 font-sans">{outcomeInfo.pushPockets.join(', ')}</div>
                                </div>
                                <span className="text-gray-400 shrink-0">±0.00</span>
                              </div>
                            )}

                            {/* Partial Loss */}
                            {outcomeInfo.partialLossPockets.length > 0 && (
                              <div className="flex items-start justify-between bg-amber-950/30 border border-amber-500/20 rounded px-2 py-1 text-amber-300">
                                <div>
                                  <span className="font-bold text-amber-400">🟠 Partial Loss</span>
                                  <span className="text-[10px] text-gray-400 ml-1.5">({outcomeInfo.partialLossPockets.length} pockets)</span>
                                  <div className="text-[10px] text-gray-300 mt-0.5 font-sans break-words max-w-[280px]">
                                    {outcomeInfo.partialLossPockets.slice(0, 18).join(', ')}{outcomeInfo.partialLossPockets.length > 18 ? ` +${outcomeInfo.partialLossPockets.length - 18} more` : ''}
                                  </div>
                                </div>
                                <span className="font-bold text-amber-400 shrink-0">
                                  {outcomeInfo.partialLossMinNet === outcomeInfo.partialLossMaxNet
                                    ? `-${currency.symbol}${Math.abs(outcomeInfo.partialLossMinNet).toFixed(2)}`
                                    : `-${currency.symbol}${Math.abs(outcomeInfo.partialLossMaxNet).toFixed(2)} ~ -${currency.symbol}${Math.abs(outcomeInfo.partialLossMinNet).toFixed(2)}`}
                                </span>
                              </div>
                            )}

                            {/* Total Loss */}
                            <div className="flex items-start justify-between bg-red-950/30 border border-red-500/20 rounded px-2 py-1 text-red-300">
                              <div>
                                <span className="font-bold text-red-400">🔴 Total Loss</span>
                                <span className="text-[10px] text-gray-400 ml-1.5">({outcomeInfo.totalLossPockets.length} pockets)</span>
                                <div className="text-[10px] text-gray-300 mt-0.5 font-sans break-words max-w-[280px]">
                                  {outcomeInfo.totalLossPockets.slice(0, 18).join(', ')}{outcomeInfo.totalLossPockets.length > 18 ? ` +${outcomeInfo.totalLossPockets.length - 18} more` : ''}
                                </div>
                              </div>
                              <span className="font-bold text-red-400 shrink-0">−{currency.symbol}{outcomeInfo.totalWager.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Simulation Parameters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                  {/* Bankroll */}
                  <div className="flex flex-col justify-between">
                    <label className="text-xs text-gray-400 mb-1 block">Starting Bankroll</label>
                    <div className="flex items-center gap-1 bg-[#0d1410] border border-white/20 rounded-lg px-2 py-1.5 focus-within:border-emerald-500">
                      <span className="text-gray-400 text-sm font-medium">{currency.symbol}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bankroll}
                        onChange={(e) => setBankroll(e.target.value)}
                        placeholder="e.g. 1000"
                        className="flex-1 bg-transparent text-white text-sm font-medium outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-transparent mt-0.5 select-none">placeholder</span>
                  </div>

                  {/* Total Sessions */}
                  <div className="flex flex-col justify-between">
                    <label className="text-xs text-gray-400 mb-1 block">Total Sessions</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totalSessions}
                      onChange={(e) => setTotalSessions(e.target.value)}
                      placeholder="e.g. 10"
                      className={INPUT}
                    />
                    <span className="text-[10px] text-transparent mt-0.5 select-none">placeholder</span>
                  </div>

                  {/* Spins per Session */}
                  <div className="flex flex-col justify-between">
                    <label className="text-xs text-gray-400 mb-1 block">Spins / Session</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totalSpins}
                      onChange={(e) => setTotalSpins(e.target.value)}
                      placeholder="e.g. 100"
                      className={INPUT}
                    />
                    <span className="text-[10px] text-transparent mt-0.5 select-none">placeholder</span>
                  </div>

                  {/* Take Profit */}
                  <div className="flex flex-col justify-between">
                    <label className="text-xs text-gray-400 mb-1 block">Take Profit (optional)</label>
                    <div className="flex items-center gap-1 bg-[#0d1410] border border-white/20 rounded-lg px-2 py-1.5 focus-within:border-emerald-500">
                      <span className="text-emerald-400 text-sm font-medium">+{currency.symbol}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={targetProfit}
                        onChange={(e) => setTargetProfit(e.target.value)}
                        placeholder="e.g. 200"
                        className="flex-1 bg-transparent text-emerald-300 text-sm font-medium outline-none"
                      />
                    </div>
                    {targetProfit && Number(targetProfit) > 0 ? (
                      <span className="text-[10px] text-emerald-400/90 font-mono mt-0.5 block truncate">
                        {bankroll && Number(bankroll) > 0
                          ? `Exit: ${currency.symbol}${(Number(bankroll) + Number(targetProfit)).toLocaleString()}`
                          : `+${currency.symbol}${targetProfit} target`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-transparent mt-0.5 select-none">optional</span>
                    )}
                  </div>

                  {/* Stop Loss */}
                  <div className="flex flex-col justify-between">
                    <label className="text-xs text-gray-400 mb-1 block">Stop Loss (optional)</label>
                    <div className="flex items-center gap-1 bg-[#0d1410] border border-white/20 rounded-lg px-2 py-1.5 focus-within:border-red-500">
                      <span className="text-red-400 text-sm font-medium">−{currency.symbol}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder="e.g. 500"
                        className="flex-1 bg-transparent text-red-300 text-sm font-medium outline-none"
                      />
                    </div>
                    {stopLoss && Number(stopLoss) > 0 ? (
                      <span className="text-[10px] text-red-400/90 font-mono mt-0.5 block truncate">
                        {bankroll && Number(bankroll) > 0
                          ? `Exit: ${currency.symbol}${Math.max(0, Number(bankroll) - Number(stopLoss)).toLocaleString()}`
                          : `−${currency.symbol}${stopLoss} limit`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-transparent mt-0.5 select-none">optional</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-white/10 shrink-0 mb-4" />

            {/* ── AI Condition Advisor ── */}
            <div className="shrink-0 mb-4">
              <AIConditionAdvisorCard
                rules={rules}
                strategyName={selectedStrategy?.name}
                levels={activeLevels}
                bankroll={parseFloat(bankroll) || 1000}
                targetProfit={targetProfit ? parseFloat(targetProfit) : undefined}
                stopLoss={stopLoss ? parseFloat(stopLoss) : undefined}
                currentConditions={conditions}
                onApplyConditions={handleApplyAIConditions}
                currencySymbol={currency.symbol}
              />
            </div>

            {/* ── Section: Condition Builder ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#00ff87]" />
                  <span className="text-sm font-semibold text-white">
                    Conditions
                    {conditions.length > 0 && (
                      <span className="ml-2 text-xs bg-[#00ff87]/15 text-[#00ff87] px-1.5 py-0.5 rounded-md font-medium">
                        {conditions.length}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Presets dropdown */}
                  <div className="relative" ref={presetsRef}>
                    <button
                      type="button"
                      onClick={() => setShowPresets((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-gray-300 hover:text-white transition cursor-pointer"
                    >
                      Presets <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {showPresets && (
                      <div className="absolute right-0 top-full mt-1 w-60 bg-[#0d1410] border border-white/20 rounded-xl shadow-2xl p-1.5 z-30">
                        {PRESET_STRATEGY_CONDITIONS.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => handleApplyPreset(p.name)}
                            className="w-full text-left px-3 py-2 hover:bg-white/8 rounded-lg transition"
                          >
                            <span className="text-sm font-semibold text-white block">{p.name}</span>
                            <span className="text-xs text-gray-500 block">{p.description}</span>
                          </button>
                        ))}
                        {conditions.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearConditions}
                            className="w-full text-left px-3 py-2 mt-1 border-t border-white/10 text-red-400 hover:bg-red-950/20 rounded-lg text-sm font-semibold transition"
                          >
                            Clear all conditions
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCondition()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#00ff87] hover:bg-[#00e676] text-black font-bold text-sm rounded-lg transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Conditions list */}
              <div
                className={`flex-1 overflow-y-auto space-y-1.5 pr-1 transition-all duration-300 ${
                  highlightConditions ? 'ring-1 ring-[#00ff87] rounded-xl bg-emerald-950/10' : ''
                }`}
              >
                {conditions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <Sliders className="w-8 h-8 mb-3 opacity-30" />
                    <p className="text-sm font-medium text-gray-400">No conditions configured</p>
                    <p className="text-xs text-gray-600 mt-1 max-w-xs">
                      Add rules to control how the level advances when certain win/loss conditions are met.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conditions.map((cond, idx) => (
                      <ConditionRuleCard
                        key={cond.id}
                        condition={cond}
                        index={idx}
                        totalLevels={activeLevels.length}
                        currencySymbol={currency.symbol}
                        onUpdate={handleUpdateCondition}
                        onDelete={handleRemoveCondition}
                        onDuplicate={handleDuplicateCondition}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer: Run / Reset ── */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
              <button
                onClick={handleRunSimulation}
                disabled={isRunning || !selectedStrategyId}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00ff87] hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm rounded-xl shadow-[0_0_16px_rgba(0,255,135,0.25)] transition cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Simulating ({simulationProgress}%)…</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Run Simulation</span>
                  </>
                )}
              </button>
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-400 text-sm font-medium transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All
              </button>
            </div>
          </div>

          {/* ════════════════ RIGHT COLUMN ════════════════ */}
          <div className="flex flex-col min-h-0 px-5 py-4">

            {/* Graph header */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance Trajectory</span>
              {hoveredPoint ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">Spin #{hoveredPoint.spin}</span>
                  <span className={hoveredPoint.balance >= (results?.initialBankroll || 0) ? 'text-[#00ff87] font-semibold' : 'text-[#ff3b30] font-semibold'}>
                    {currency.symbol}{hoveredPoint.balance.toLocaleString()}
                  </span>
                  <span className="text-gray-500">L{hoveredPoint.level}</span>
                  <span className="text-xs text-gray-400 bg-white/8 px-2 py-0.5 rounded-md">
                    {hoveredPoint.outcome.replace('_', ' ')}: {hoveredPoint.netWin >= 0 ? `+${currency.symbol}${hoveredPoint.netWin}` : `-${currency.symbol}${Math.abs(hoveredPoint.netWin)}`}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-600">Hover chart to inspect spins</span>
              )}
            </div>

            {/* Canvas */}
            <div className="w-full h-48 bg-[#030604] border border-white/10 rounded-xl overflow-hidden shrink-0 relative">
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
                className="w-full h-full cursor-crosshair block"
              />

              {/* Staged Simulation Animation Overlay on Canvas */}
              {isRunning && (
                <div className="absolute inset-0 bg-[#060a08]/92 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 space-y-2.5">
                  <div className="relative w-11 h-11 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-[#00ff87] animate-spin" />
                    <Activity className="w-5 h-5 text-[#00ff87] animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-ping" />
                      <span>{simulationStage}</span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400">
                      Processed: <strong className="text-white">{simulatedSpinsCount.toLocaleString()}</strong> spins ({simulationProgress}%)
                    </div>
                  </div>
                  <div className="w-48 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 via-teal-400 to-[#00ff87] rounded-full transition-all duration-150"
                      style={{ width: `${simulationProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Enhanced KPI Strip ── */}
            {results ? (
              results.totalSessions > 1 ? (
                <div className="py-2.5 my-2 border-y border-white/10 shrink-0 space-y-2.5">
                  {/* Outcome Distribution Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-400">
                        Session Outcomes ({results.totalSessions} total):{' '}
                        <span className="text-[#00ff87] font-bold">{results.sessionsWon} Won ({results.sessionWinRate}%)</span>
                        {results.sessionsBreakeven > 0 && (
                          <span className="text-gray-400 font-semibold"> • {results.sessionsBreakeven} Even</span>
                        )}
                        <span className="text-[#ff3b30] font-bold"> • {results.sessionsLost} Lost ({((results.sessionsLost / results.totalSessions) * 100).toFixed(1)}%)</span>
                      </span>
                      <span className="text-gray-500 text-[11px]">
                        TP: {results.targetProfitHits} ({results.targetProfitHitRate}%) | SL: {results.stopLossHits} ({results.stopLossHitRate}%) | Bust: {results.bustCount} ({results.bustRate}%)
                      </span>
                    </div>
                    {/* Visual Segment Bar */}
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${(results.sessionsWon / results.totalSessions) * 100}%` }}
                        className="bg-[#00ff87] h-full transition-all duration-300"
                        title={`Won: ${results.sessionsWon} sessions (${results.sessionWinRate}%)`}
                      />
                      <div
                        style={{ width: `${(results.sessionsBreakeven / results.totalSessions) * 100}%` }}
                        className="bg-gray-500 h-full transition-all duration-300"
                        title={`Even: ${results.sessionsBreakeven} sessions`}
                      />
                      <div
                        style={{ width: `${(results.sessionsLost / results.totalSessions) * 100}%` }}
                        className="bg-[#ff3b30] h-full transition-all duration-300"
                        title={`Lost: ${results.sessionsLost} sessions (${((results.sessionsLost / results.totalSessions) * 100).toFixed(1)}%)`}
                      />
                    </div>
                  </div>

                  {/* 4-col Multi-Session Primary KPI Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Session Win Rate</span>
                      <span className="text-base font-bold text-[#00ff87] block">{results.sessionWinRate}%</span>
                      <span className="text-xs text-gray-400 block">{results.sessionsWon}W / {results.sessionsLost}L / {results.sessionsBreakeven}E</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Avg Net / Session</span>
                      <span className={`text-base font-bold block ${results.avgProfitPerSession >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                        {results.avgProfitPerSession >= 0 ? `+${currency.symbol}${results.avgProfitPerSession.toFixed(2)}` : `-${currency.symbol}${Math.abs(results.avgProfitPerSession).toFixed(2)}`}
                      </span>
                      <span className="text-xs text-gray-400 block">Med: {results.medianProfitPerSession >= 0 ? '+' : ''}{currency.symbol}{results.medianProfitPerSession.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Best / Worst Session</span>
                      <span className="text-xs font-bold text-[#00ff87] block">▲ {results.bestSessionNet >= 0 ? '+' : ''}{currency.symbol}{results.bestSessionNet.toFixed(2)}</span>
                      <span className="text-xs font-bold text-[#ff3b30] block">▼ {results.worstSessionNet >= 0 ? '+' : ''}{currency.symbol}{results.worstSessionNet.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Exit Triggers</span>
                      <span className="text-xs font-semibold text-emerald-400 block">TP: {results.targetProfitHits} ({results.targetProfitHitRate}%)</span>
                      <span className="text-xs font-semibold text-red-400 block">SL: {results.stopLossHits} ({results.stopLossHitRate}%) • B: {results.bustCount}</span>
                    </div>
                  </div>

                  {/* 4-col Secondary Quant Bar */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Avg Session Spins</span>
                      <span className="font-semibold text-gray-200">{results.avgSpinsPerSession} spins</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Worst Max DD</span>
                      <span className="font-semibold text-[#ff3b30]">{currency.symbol}{results.maxDrawdown.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Total Spins / Win%</span>
                      <span className="font-semibold text-gray-200">{results.completedSpins.toLocaleString()} ({results.winRate}%)</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Profit Factor</span>
                      <span className="font-semibold text-emerald-400">PF {results.profitFactor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-2.5 my-2 border-y border-white/10 shrink-0 space-y-2">
                  {/* Primary Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Final Balance</span>
                      <span className="text-base font-bold text-white block">{currency.symbol}{results.finalBankroll.toLocaleString()}</span>
                      <span className={`text-xs font-semibold block ${results.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                        {results.netProfit >= 0 ? `+${results.roiPercent}% (+${currency.symbol}${results.netProfit.toLocaleString()})` : `${results.roiPercent}% (-${currency.symbol}${Math.abs(results.netProfit).toLocaleString()})`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Peak / Low</span>
                      <span className="text-sm font-semibold text-[#00ff87] block">▲ {currency.symbol}{results.peakBankroll.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 block">▼ {currency.symbol}{results.lowestBankroll.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Max Drawdown</span>
                      <span className="text-sm font-bold text-[#ff3b30] block">{currency.symbol}{results.maxDrawdown.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 block">{results.maxDrawdownPercent}% of peak</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Expectancy</span>
                      <span className={`text-base font-bold block ${results.expectancyRatio >= 1.0 ? 'text-[#00ff87]' : 'text-amber-400'}`}>
                        {results.expectancyRatio.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-400 block">{currency.symbol}{results.expectancyPerSpin.toFixed(2)}/spin</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Win Rate</span>
                      <span className="text-sm font-semibold text-[#00ff87] block">{results.winRate}%</span>
                      <span className="text-xs text-gray-400 block">Max: {results.maxWins} | Part: {results.partialWins}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 uppercase block mb-0.5">Profit Factor</span>
                      <span className="text-sm font-bold text-white block">PF {results.profitFactor.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 block">W{results.longestWinStreak} / L{results.longestLossStreak}</span>
                    </div>
                  </div>

                  {/* Secondary Quant Metrics Bar */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Total Wagered</span>
                      <span className="font-semibold text-gray-200">{currency.symbol}{results.totalWagered?.toLocaleString() ?? 0}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Avg / Max Bet</span>
                      <span className="font-semibold text-gray-200">{currency.symbol}{results.avgBetSize ?? 0} / {currency.symbol}{results.maxBetSize ?? 0}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Sharpe Ratio</span>
                      <span className={`font-semibold ${(results.sharpeRatio ?? 0) >= 1 ? 'text-[#00ff87]' : (results.sharpeRatio ?? 0) >= 0 ? 'text-amber-400' : 'text-[#ff3b30]'}`}>
                        {results.sharpeRatio?.toFixed(2) ?? '0.00'}
                      </span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                      <span className="text-gray-500 text-[10px] block uppercase">Recovery Factor</span>
                      <span className="font-semibold text-emerald-400">{results.recoveryFactor?.toFixed(2) ?? '0.00'}</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="py-6 my-3 border-y border-white/8 text-center text-sm text-gray-600 shrink-0">
                Run a simulation to see statistics
              </div>
            )}

            {/* ── Tabs: Sessions / Spin Log / Levels / Rule Triggers / AI Advisor ── */}
            {results && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3">
                    {results.totalSessions > 1 && (
                      <button
                        type="button"
                        onClick={() => setActiveAnalysisTab('sessions')}
                        className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition ${
                          activeAnalysisTab === 'sessions'
                            ? 'text-white border-[#00ff87]'
                            : 'text-gray-500 border-transparent hover:text-gray-300'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-[#00ff87]" />
                        Sessions ({results.totalSessions})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab('spins')}
                      className={`text-sm font-semibold pb-1 border-b-2 transition ${
                        activeAnalysisTab === 'spins'
                          ? 'text-white border-[#00ff87]'
                          : 'text-gray-500 border-transparent hover:text-gray-300'
                      }`}
                    >
                      {results.totalSessions > 1
                        ? `Spin Log (S#${inspectedSessionIndex})`
                        : `Spin Log (${results.history.length - 1})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab('levels')}
                      className={`text-sm font-semibold pb-1 border-b-2 transition ${
                        activeAnalysisTab === 'levels'
                          ? 'text-white border-[#00ff87]'
                          : 'text-gray-500 border-transparent hover:text-gray-300'
                      }`}
                    >
                      Levels ({results.levelStats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab('rules')}
                      className={`text-sm font-semibold pb-1 border-b-2 transition ${
                        activeAnalysisTab === 'rules'
                          ? 'text-white border-[#00ff87]'
                          : 'text-gray-500 border-transparent hover:text-gray-300'
                      }`}
                    >
                      Rule Triggers ({results.conditionStats?.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab('advisor')}
                      className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition ${
                        activeAnalysisTab === 'advisor'
                          ? 'text-emerald-400 border-emerald-400'
                          : 'text-gray-500 border-transparent hover:text-emerald-400/70'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-[#00ff87]" />
                      AI Advisor
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {results.totalSessions > 1 && (
                      <button
                        type="button"
                        onClick={handleExportSessionsCSV}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/15 hover:bg-white/10 text-gray-300 font-medium text-xs rounded-lg transition cursor-pointer"
                        title="Download summary of all sessions as CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Sessions CSV</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 hover:bg-emerald-900/60 text-[#00ff87] font-semibold text-xs rounded-lg transition cursor-pointer"
                      title={results.totalSessions > 1 ? `Download spin audit log for Session #${inspectedSessionIndex} as CSV` : 'Download complete spin audit log as CSV'}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{results.totalSessions > 1 ? `Spins CSV (#${inspectedSessionIndex})` : 'Export CSV'}</span>
                    </button>
                  </div>
                </div>

                {/* ── TAB 0: Multi-Session Explorer ── */}
                {activeAnalysisTab === 'sessions' && results.totalSessions > 1 && (
                  <div className="flex-1 flex flex-col min-h-0 mt-2">
                    {/* Sessions Quick Bar */}
                    <div className="flex items-center justify-between pb-2 shrink-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono">
                          Showing <span className="text-white font-bold">{results.sessions.length}</span> Sessions
                        </span>
                        {bestSession && (
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedSessionIndex(bestSession.sessionIndex);
                              setActiveAnalysisTab('spins');
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[#00ff87] hover:bg-emerald-900/60 font-medium transition cursor-pointer"
                            title="Inspect best performing session"
                          >
                            Best: #{bestSession.sessionIndex} (+{currency.symbol}{bestSession.netProfit.toFixed(2)})
                          </button>
                        )}
                        {worstSession && (
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedSessionIndex(worstSession.sessionIndex);
                              setActiveAnalysisTab('spins');
                            }}
                            className="px-2 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-[#ff3b30] hover:bg-red-900/60 font-medium transition cursor-pointer"
                            title="Inspect worst performing session"
                          >
                            Worst: #{worstSession.sessionIndex} ({currency.symbol}{worstSession.netProfit.toFixed(2)})
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500">
                        Click row or "Inspect" to view spin audit log & highlight on chart
                      </span>
                    </div>

                    {/* Sessions Table */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="sticky top-0 bg-[#070c09] z-10 border-b border-white/10 text-[11px] text-gray-500 uppercase">
                          <tr>
                            <th className="py-1.5 pr-2">#</th>
                            <th className="py-1.5 pr-2">Spins</th>
                            <th className="py-1.5 pr-2">Exit Reason</th>
                            <th className="py-1.5 pr-2">Peak / Low</th>
                            <th className="py-1.5 pr-2">Max DD</th>
                            <th className="py-1.5 pr-2">Final Balance</th>
                            <th className="py-1.5 pr-2">Net P&L</th>
                            <th className="py-1.5 pr-2">W / L</th>
                            <th className="py-1.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {results.sessions.map((s) => {
                            const isSelected = s.sessionIndex === inspectedSessionIndex;
                            return (
                              <tr
                                key={s.sessionIndex}
                                onClick={() => setInspectedSessionIndex(s.sessionIndex)}
                                className={`cursor-pointer transition ${
                                  isSelected
                                    ? 'bg-[#00ff87]/10 border-l-2 border-[#00ff87]'
                                    : 'hover:bg-white/[0.03]'
                                }`}
                              >
                                <td className="py-1.5 pr-2 font-bold text-white">
                                  #{s.sessionIndex}
                                </td>
                                <td className="py-1.5 pr-2 text-gray-300">
                                  {s.completedSpins} <span className="text-gray-600">/ {results.totalSpins}</span>
                                </td>
                                <td className="py-1.5 pr-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      s.stopReason === 'Target Profit Reached'
                                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-[#00ff87]'
                                        : s.stopReason === 'Stop Loss Hit' || s.stopReason?.includes('depleted') || s.stopReason === 'Ruin / Busted'
                                        ? 'bg-red-950/60 border border-red-500/40 text-[#ff3b30]'
                                        : 'bg-white/5 border border-white/10 text-gray-400'
                                    }`}
                                  >
                                    {s.stopReason || 'Max Spins'}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-2 whitespace-nowrap">
                                  <span className="text-[#00ff87]">▲{currency.symbol}{s.peakBankroll.toLocaleString()}</span>{' '}
                                  <span className="text-gray-500">▼{currency.symbol}{s.lowestBankroll.toLocaleString()}</span>
                                </td>
                                <td className="py-1.5 pr-2 text-[#ff3b30] font-semibold whitespace-nowrap">
                                  {currency.symbol}{s.maxDrawdown.toLocaleString()}
                                </td>
                                <td className="py-1.5 pr-2 font-semibold text-gray-200 whitespace-nowrap">
                                  {currency.symbol}{s.finalBankroll.toLocaleString()}
                                </td>
                                <td className={`py-1.5 pr-2 font-bold whitespace-nowrap ${s.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                  {s.netProfit >= 0 ? `+${currency.symbol}${s.netProfit.toLocaleString()} (+${s.roiPercent}%)` : `-${currency.symbol}${Math.abs(s.netProfit).toLocaleString()} (${s.roiPercent}%)`}
                                </td>
                                <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">
                                  <span className="text-[#00ff87]">{s.totalWins}</span>
                                  <span className="text-gray-600">/</span>
                                  <span className="text-[#ff3b30]">{s.totalLosses}</span>
                                </td>
                                <td className="py-1.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectedSessionIndex(s.sessionIndex);
                                      setActiveAnalysisTab('spins');
                                    }}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#00ff87] text-black font-bold'
                                        : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/20'
                                    }`}
                                  >
                                    {isSelected ? 'Inspecting' : 'Inspect'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── TAB 1: Spin-by-spin Log with Filters ── */}
                {activeAnalysisTab === 'spins' && (
                  <div className="flex-1 flex flex-col min-h-0 mt-2">
                    {/* Multi-session Session Picker Bar */}
                    {results.totalSessions > 1 && (
                      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-white/5 shrink-0 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-semibold">Inspecting:</span>
                          <select
                            value={inspectedSessionIndex}
                            onChange={(e) => setInspectedSessionIndex(parseInt(e.target.value, 10))}
                            className="bg-[#0d1410] border border-white/20 rounded px-2 py-1 text-xs text-white font-medium outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            {results.sessions.map((s) => (
                              <option key={s.sessionIndex} value={s.sessionIndex} className="bg-[#0d1410] text-white">
                                Session #{s.sessionIndex}: {s.netProfit >= 0 ? `+${currency.symbol}${s.netProfit.toFixed(1)}` : `-${currency.symbol}${Math.abs(s.netProfit).toFixed(1)}`} ({s.stopReason || 'Max Spins'})
                              </option>
                            ))}
                          </select>
                          {bestSession && (
                            <button
                              type="button"
                              onClick={() => setInspectedSessionIndex(bestSession.sessionIndex)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                inspectedSessionIndex === bestSession.sessionIndex
                                  ? 'bg-[#00ff87] text-black'
                                  : 'bg-emerald-950/60 border border-emerald-500/40 text-[#00ff87] hover:bg-emerald-900/60'
                              }`}
                            >
                              Best (#{bestSession.sessionIndex})
                            </button>
                          )}
                          {worstSession && (
                            <button
                              type="button"
                              onClick={() => setInspectedSessionIndex(worstSession.sessionIndex)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                inspectedSessionIndex === worstSession.sessionIndex
                                  ? 'bg-[#ff3b30] text-white'
                                  : 'bg-red-950/60 border border-red-500/40 text-[#ff3b30] hover:bg-red-900/60'
                              }`}
                            >
                              Worst (#{worstSession.sessionIndex})
                            </button>
                          )}
                        </div>
                        {inspectedSession && (
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="text-gray-400">Exit: <b className="text-gray-200">{inspectedSession.stopReason || 'Max Spins'}</b></span>
                            <span className="text-gray-600">•</span>
                            <span className={inspectedSession.netProfit >= 0 ? 'text-[#00ff87] font-bold' : 'text-[#ff3b30] font-bold'}>
                              Net: {inspectedSession.netProfit >= 0 ? `+${currency.symbol}${inspectedSession.netProfit.toFixed(2)}` : `-${currency.symbol}${Math.abs(inspectedSession.netProfit).toFixed(2)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Filters & Search */}
                    <div className="flex items-center justify-between gap-2 pb-2 shrink-0">
                      <div className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setSpinFilter('all')}
                          className={`px-2 py-1 rounded transition ${spinFilter === 'all' ? 'bg-white/20 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                        >
                          All ({Math.max(0, activeHistory.length - 1)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpinFilter('rules')}
                          className={`px-2 py-1 rounded transition ${spinFilter === 'rules' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-gray-400 hover:text-amber-300'}`}
                        >
                          Rules Fired ({activeHistory.slice(1).filter((p) => p.conditionApplied).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpinFilter('wins')}
                          className={`px-2 py-1 rounded transition ${spinFilter === 'wins' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-gray-400 hover:text-emerald-300'}`}
                        >
                          Wins ({activeHistory.slice(1).filter((p) => p.netWin > 0).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpinFilter('losses')}
                          className={`px-2 py-1 rounded transition ${spinFilter === 'losses' ? 'bg-red-500/20 text-red-300 font-bold border border-red-500/30' : 'text-gray-400 hover:text-red-300'}`}
                        >
                          Losses ({activeHistory.slice(1).filter((p) => p.netWin < 0).length})
                        </button>
                      </div>
                      <div className="relative w-44">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
                        <input
                          type="text"
                          value={spinSearch}
                          onChange={(e) => setSpinSearch(e.target.value)}
                          placeholder="Search number, rule…"
                          className="w-full pl-7 pr-2 py-1 bg-[#0d1410] border border-white/15 rounded text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="sticky top-0 bg-[#070c09] z-10 border-b border-white/10 text-[11px] text-gray-500 uppercase">
                          <tr>
                            <th className="py-1.5 pr-2">#</th>
                            <th className="py-1.5 pr-2">Num</th>
                            <th className="py-1.5 pr-2">Bet</th>
                            <th className="py-1.5 pr-2">Wager</th>
                            <th className="py-1.5 pr-2">Payout</th>
                            <th className="py-1.5 pr-2">Net Win</th>
                            <th className="py-1.5 pr-2">Cumul P&L</th>
                            <th className="py-1.5 pr-2">Balance</th>
                            <th className="py-1.5">Rule Trigger & Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredHistory.map((pt) => (
                            <tr key={pt.spin} className={`hover:bg-white/[0.03] transition ${pt.conditionApplied ? 'bg-white/[0.015]' : ''}`}>
                              <td className="py-1.5 pr-2 text-gray-400 font-semibold">{pt.spin}</td>
                              <td className="py-1.5 pr-2">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] ${getPocketBadgeClass(pt.pocket)}`}>
                                  {pt.pocket}
                                </span>
                              </td>
                              <td className="py-1.5 pr-2 text-gray-300 font-semibold whitespace-nowrap">
                                L{pt.level} <span className="text-[#00ff87]">×{pt.multiplier}</span>
                              </td>
                              <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">{currency.symbol}{pt.wager.toFixed(2)}</td>
                              <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">{currency.symbol}{pt.payout.toFixed(2)}</td>
                              <td className={`py-1.5 pr-2 font-bold whitespace-nowrap ${pt.netWin > 0 ? 'text-[#00ff87]' : pt.netWin < 0 ? 'text-[#ff3b30]' : 'text-gray-400'}`}>
                                {pt.netWin > 0 ? `+${currency.symbol}${pt.netWin.toFixed(2)}` : pt.netWin < 0 ? `-${currency.symbol}${Math.abs(pt.netWin).toFixed(2)}` : `${currency.symbol}0.00`}
                              </td>
                              <td className={`py-1.5 pr-2 font-bold whitespace-nowrap ${pt.cumulativeProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                {pt.cumulativeProfit >= 0 ? `+${currency.symbol}${pt.cumulativeProfit.toFixed(2)}` : `-${currency.symbol}${Math.abs(pt.cumulativeProfit).toFixed(2)}`}
                              </td>
                              <td className="py-1.5 pr-2 text-gray-200 font-semibold whitespace-nowrap">{currency.symbol}{pt.balance.toFixed(2)}</td>
                              <td className="py-1.5">
                                {pt.conditionApplied ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px] font-semibold">
                                      {pt.conditionApplied}
                                    </span>
                                    <span className="text-gray-500">➔</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[#00ff87] text-[10px] font-bold">
                                      {pt.actionTaken}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: Level Breakdown Table ── */}
                {activeAnalysisTab === 'levels' && (
                  <div className="flex-1 overflow-y-auto mt-2 pr-1">
                    <table className="w-full text-left text-sm font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                          <th className="pb-2 pr-3">Level</th>
                          <th className="pb-2 pr-3">Wager</th>
                          <th className="pb-2 pr-3">Spins</th>
                          <th className="pb-2 pr-3">W / L</th>
                          <th className="pb-2 pr-3">Win%</th>
                          <th className="pb-2 pr-3">Net P&L</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {results.levelStats.map((stat) => (
                          <tr key={stat.levelNumber} className="hover:bg-white/[0.025] transition">
                            <td className="py-1.5 pr-3 font-bold text-white">L{stat.levelNumber}</td>
                            <td className="py-1.5 pr-3 text-gray-300">{currency.symbol}{stat.wager}</td>
                            <td className="py-1.5 pr-3 text-gray-400">{stat.spinsCount} <span className="text-gray-600">({stat.spinsPercent}%)</span></td>
                            <td className="py-1.5 pr-3">
                              <span className="text-[#00ff87]">{stat.maxWins + stat.partialWins}</span>
                              <span className="text-gray-600">/</span>
                              <span className="text-[#ff3b30]">{stat.totalLosses + stat.partialLosses}</span>
                            </td>
                            <td className="py-1.5 pr-3 text-gray-200">{stat.winRate}%</td>
                            <td className={`py-1.5 pr-3 font-bold ${stat.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                              {stat.netProfit >= 0 ? `+${currency.symbol}${stat.netProfit.toLocaleString()}` : `-${currency.symbol}${Math.abs(stat.netProfit).toLocaleString()}`}
                            </td>
                            <td className="py-1.5 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                stat.status === 'Profit Driver' ? 'text-[#00ff87] bg-emerald-950/40' :
                                stat.status === 'Drawdown Driver' ? 'text-[#ff3b30] bg-red-950/40' :
                                stat.status === 'High Bleed' ? 'text-amber-400 bg-amber-950/40' :
                                'text-gray-400'
                              }`}>
                                {stat.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── TAB 3: Rule Trigger Performance ── */}
                {activeAnalysisTab === 'rules' && (
                  <div className="flex-1 overflow-y-auto mt-2 pr-1">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] text-gray-500 uppercase">
                          <th className="pb-2 pr-2">Rule #</th>
                          <th className="pb-2 pr-3">Trigger Condition</th>
                          <th className="pb-2 pr-3">Action</th>
                          <th className="pb-2 pr-3">Times Fired</th>
                          <th className="pb-2 pr-3">Trigger Rate</th>
                          <th className="pb-2 text-right">Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(results.conditionStats || []).map((stat) => (
                          <tr key={stat.conditionId} className="hover:bg-white/[0.025] transition">
                            <td className="py-2 pr-2 font-bold text-white">Rule #{stat.ruleNumber}</td>
                            <td className="py-2 pr-3 text-amber-300 font-semibold">{stat.triggerDesc}</td>
                            <td className="py-2 pr-3 text-[#00ff87] font-semibold">{stat.actionDesc}</td>
                            <td className="py-2 pr-3 text-white font-bold text-sm">{stat.triggerCount}</td>
                            <td className="py-2 pr-3 text-gray-300">{stat.triggerPercent}% <span className="text-gray-600">of spins</span></td>
                            <td className="py-2 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${stat.triggerCount > 0 ? 'text-[#00ff87] bg-emerald-950/40 border border-emerald-500/30' : 'text-gray-500 bg-white/5'}`}>
                                {stat.triggerCount > 0 ? `${stat.triggerCount}× Fired` : 'Never Fired'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── TAB 4: AI Advisor ── */}
                {activeAnalysisTab === 'advisor' && results.aiSuggestions && (
                  <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3">
                    {/* Diagnosis Header */}
                    <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-transparent border border-emerald-500/30 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#00ff87]" />
                          <span className="text-xs font-bold text-white tracking-wide uppercase">{results.aiSuggestions.title}</span>
                        </div>
                        {results.aiSuggestions.archetype && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 uppercase shrink-0">
                            {results.aiSuggestions.archetype.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed font-sans">{results.aiSuggestions.diagnosis}</p>
                    </div>

                    {/* Key Empirical Observations */}
                    {results.aiSuggestions.keyObservations.length > 0 && (
                      <div className="space-y-1 p-2.5 bg-black/40 border border-white/10 rounded-xl">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Observed Performance Patterns</span>
                        <div className="space-y-1">
                          {results.aiSuggestions.keyObservations.map((obs, oIdx) => (
                            <div key={oIdx} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-[#00ff87] font-bold mt-0.5">•</span>
                              <span className="leading-snug">{obs}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Rules Selection List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Dynamic Rule Recommendations ({results.aiSuggestions.suggestedConditions.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectAllAdvisorRules}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                        >
                          {selectedAdvisorRules.length === results.aiSuggestions.suggestedConditions.length
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {results.aiSuggestions.suggestedConditions.map((cond, cIdx) => {
                          const isChecked = selectedAdvisorRules.includes(cond.id);
                          const reasonText = cond.reason || results.aiSuggestions?.conditionReasons?.[cond.id];
                          return (
                            <div
                              key={cond.id || cIdx}
                              onClick={() => handleToggleAdvisorRule(cond.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                                  : 'bg-[#080d0a]/60 border-white/10 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleAdvisorRule(cond.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 rounded accent-[#00ff87] cursor-pointer"
                                />
                                <div className="flex-1 flex items-center gap-1.5 flex-wrap text-xs">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold font-mono text-[10px]">
                                    {formatTriggerDesc(cond)}
                                  </span>
                                  <span className="text-gray-500 font-bold">→</span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold font-mono text-[10px]">
                                    {formatActionDesc(cond)}
                                  </span>
                                </div>
                              </div>

                              {/* Rationale Badge */}
                              {reasonText && (
                                <div className="mt-1.5 pl-5 text-[11px] text-gray-300 leading-relaxed flex items-start gap-1.5">
                                  <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <span><strong className="text-emerald-400 font-medium">Why:</strong> {reasonText}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions: Merge vs Replace */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleMergeAISuggestions}
                        disabled={selectedAdvisorRules.length === 0}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-xl text-xs font-bold text-[#00ff87] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="Append selected rules into existing workflow without removing current rules"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Merge Selected ({selectedAdvisorRules.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleReplaceAISuggestions}
                        disabled={selectedAdvisorRules.length === 0}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00ff87] hover:bg-[#00e676] text-black rounded-xl text-xs font-extrabold disabled:opacity-30 disabled:cursor-not-allowed transition shadow-[0_0_12px_rgba(0,255,135,0.25)] cursor-pointer"
                        title="Replace entire existing workflow with these selected rules"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Replace Existing ({selectedAdvisorRules.length})
                      </button>
                    </div>

                    {/* Expected Impact */}
                    {results.aiSuggestions.predictedImpact && (
                      <div className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/25 rounded-xl p-2.5">
                        <strong className="text-emerald-400">Expected Impact: </strong>
                        {results.aiSuggestions.predictedImpact}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
