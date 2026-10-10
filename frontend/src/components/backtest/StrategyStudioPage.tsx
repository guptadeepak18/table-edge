import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSimulatorStore, type ProgressionLevel } from '../../stores/simulator.store';
import {
  Activity,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Check,
  Zap,
  Download,
  Search,
  Layers,
  ChevronDown,
  ArrowLeft,
  LayoutGrid,
  Play,
  HelpCircle,
  TrendingUp,
  Info,
  Sparkles,
  Loader2,
  Plus,
  X,
  FileSpreadsheet,
  Brain,
  ShieldAlert,
  BarChart3,
  Percent,
  Coins,
  ShieldCheck,
  Scale,
  Gauge,
  Flame,
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
import { WorkflowPipeline } from './WorkflowPipeline';
import { NaturalLanguageArchitectModal } from './NaturalLanguageArchitectModal';
import { AIConditionAdvisorModal } from './AIConditionAdvisorModal';
import { CustomSelect, type CustomSelectOption } from '../common/CustomSelect';

interface StrategyStudioPageProps {
  onBackToTable: () => void;
  onBackToHub: () => void;
}

export const StrategyStudioPage: React.FC<StrategyStudioPageProps> = ({
  onBackToTable,
  onBackToHub,
}) => {
  const { savedLevels, strategies, rules, currency } = useSimulatorStore();

  // Configuration States — NO pre-filled values
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [bankroll, setBankroll] = useState<string>('');
  const [totalSessions, setTotalSessions] = useState<string>('');
  const [totalSpins, setTotalSpins] = useState<string>('');
  const [targetProfit, setTargetProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [conditions, setConditions] = useState<StrategyCondition[]>([]);
  const [showOutcomeGuide, setShowOutcomeGuide] = useState(false);

  // Modals for AI tools (do not expand automatically inline)
  const [isNLModalOpen, setIsNLModalOpen] = useState(false);
  const [isAIAdvisorModalOpen, setIsAIAdvisorModalOpen] = useState(false);

  // Simulation & Analysis States
  const [isRunning, setIsRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationStage, setSimulationStage] = useState<string>('Initializing Monte Carlo Models...');
  const [simulatedSpinsCount, setSimulatedSpinsCount] = useState<number>(0);
  const [selectedAdvisorRules, setSelectedAdvisorRules] = useState<string[]>([]);

  const [results, setResults] = useState<AdvancedBacktestResult | null>(null);
  const [selectedSessionScope, setSelectedSessionScope] = useState<'overall' | number>('overall');
  const [inspectedSessionIndex, setInspectedSessionIndex] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BacktestHistoryPoint | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'overview' | 'sessions' | 'levels' | 'rules' | 'advisor'>('overview');
  
  // Spin Log Drawer State
  const [isSpinDrawerOpen, setIsSpinDrawerOpen] = useState(false);
  const [spinFilter, setSpinFilter] = useState<'all' | 'rules' | 'wins' | 'losses' | 'max_win' | 'partial_win' | 'partial_loss' | 'total_loss'>('all');
  const [spinSearch, setSpinSearch] = useState<string>('');
  const [showPresets, setShowPresets] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Close presets menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close Spin Drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSpinDrawerOpen) {
        setIsSpinDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpinDrawerOpen]);

  // Strategy Resolution
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

  const outcomeInfo = useMemo(() => {
    if (!activeLevels || activeLevels.length === 0) return null;
    return inspectLevelOutcomes(activeLevels[0], rules);
  }, [activeLevels, rules]);

  // Strategy Select Options
  const strategySelectOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [];
    if (savedLevels.some((l) => l.placements.length > 0)) {
      opts.push({
        value: '__active__',
        label: 'Active Table Progression',
        description: `${savedLevels.length} progression level(s) on table felt`,
        badge: 'LIVE',
      });
    }
    strategies.forEach((strat) => {
      opts.push({
        value: strat.id,
        label: strat.name,
        description: `${strat.levels?.length || 0} progression level(s) configured`,
      });
    });
    return opts;
  }, [savedLevels, strategies]);

  // Session & History Accessors
  const inspectedSession: SessionRecord | null = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    const targetIdx = typeof selectedSessionScope === 'number' ? selectedSessionScope : inspectedSessionIndex;
    return results.sessions.find((s) => s.sessionIndex === targetIdx) || results.sessions[0];
  }, [results, selectedSessionScope, inspectedSessionIndex]);

  const activeHistory: BacktestHistoryPoint[] = useMemo(() => {
    if (!results) return [];
    if (results.totalSessions === 1) return results.history;
    if (typeof selectedSessionScope === 'number') {
      const sess = results.sessions.find((s) => s.sessionIndex === selectedSessionScope);
      if (sess?.history && sess.history.length > 0) return sess.history;
    }
    if (inspectedSession?.history && inspectedSession.history.length > 0) {
      return inspectedSession.history;
    }
    return results.history;
  }, [results, selectedSessionScope, inspectedSession]);

  const bestSession = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    return results.sessions.reduce((prev, curr) => (curr.netProfit > prev.netProfit ? curr : prev), results.sessions[0]);
  }, [results]);

  const worstSession = useMemo(() => {
    if (!results || !results.sessions || results.sessions.length === 0) return null;
    return results.sessions.reduce((prev, curr) => (curr.netProfit < prev.netProfit ? curr : prev), results.sessions[0]);
  }, [results]);

  const filteredHistory = useMemo(() => {
    if (!results) return [];
    return activeHistory.slice(1).filter((pt) => {
      if (spinFilter === 'rules' && !pt.conditionApplied) return false;
      if (spinFilter === 'wins' && pt.netWin <= 0) return false;
      if (spinFilter === 'losses' && pt.netWin >= 0) return false;
      if (spinFilter === 'max_win' && pt.outcome !== 'max_win') return false;
      if (spinFilter === 'partial_win' && pt.outcome !== 'partial_win') return false;
      if (spinFilter === 'partial_loss' && pt.outcome !== 'partial_loss') return false;
      if (spinFilter === 'total_loss' && pt.outcome !== 'total_loss') return false;
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

  const getPocketBadgeClass = (pocket?: number | string) => {
    if (pocket === undefined || pocket === '-') return 'bg-white/10 text-gray-400';
    const str = String(pocket);
    if (str === '0' || str === '00') return 'bg-emerald-600 text-white font-bold';
    const redPockets = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const num = parseInt(str, 10);
    if (!isNaN(num) && redPockets.includes(num)) return 'bg-red-600 text-white font-bold';
    return 'bg-zinc-800 text-white font-bold border border-white/20';
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'max_win':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-950/70 text-[#00ff87] border border-emerald-500/30">MAX WIN</span>;
      case 'partial_win':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-950/70 text-blue-400 border border-blue-500/30">PART WIN</span>;
      case 'push':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-zinc-800 text-gray-300 border border-white/20">PUSH</span>;
      case 'partial_loss':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-950/70 text-orange-400 border border-orange-500/30">PART LOSS</span>;
      case 'total_loss':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-950/70 text-[#ff3b30] border border-red-500/30">TOTAL LOSS</span>;
      default:
        return <span className="text-gray-500 text-xs">—</span>;
    }
  };

  // Rule Handlers
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

  const handleApplyPreset = (presetName: string) => {
    const preset = PRESET_STRATEGY_CONDITIONS.find((p) => p.name === presetName);
    if (!preset) return;
    const cloned = preset.conditions.map((c, idx) => ({ ...c, id: `preset-${idx}-${Date.now()}` }));
    setConditions(cloned);
    setShowPresets(false);
  };

  const handleResetAll = () => {
    setSelectedStrategyId('');
    setBankroll('');
    setTotalSessions('');
    setTotalSpins('');
    setTargetProfit('');
    setStopLoss('');
    setConditions([]);
    setResults(null);
    setErrorMessage(null);
    setHoveredPoint(null);
    setInspectedSessionIndex(1);
    setActiveAnalysisTab('overview');
    setIsSpinDrawerOpen(false);
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
  };

  // Staged Monte Carlo Simulation Handler
  const handleRunSimulation = async () => {
    setErrorMessage(null);
    if (!selectedStrategyId) { setErrorMessage('Please select a progression strategy to test.'); return; }
    if (activeLevels.length === 0) { setErrorMessage('Selected strategy has no active progression levels with placed bets.'); return; }
    const bankrollNum = parseFloat(bankroll);
    if (!bankroll || isNaN(bankrollNum) || bankrollNum <= 0) { setErrorMessage('Please enter a valid Starting Bankroll (greater than 0).'); return; }
    const spinsNum = parseInt(totalSpins, 10);
    if (!totalSpins || isNaN(spinsNum) || spinsNum <= 0) { setErrorMessage('Please enter a valid Number of Spins per session (>= 1).'); return; }
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

    // Stage 1
    await new Promise((r) => setTimeout(r, 260));
    setSimulationProgress(32);
    setSimulationStage('Calibrating rule triggers & table payout matrices...');
    setSimulatedSpinsCount(Math.round(totalTargetSpins * 0.22));

    // Stage 2
    await new Promise((r) => setTimeout(r, 340));
    setSimulationProgress(68);
    setSimulationStage(`Evaluating ${totalTargetSpins.toLocaleString()} Monte Carlo trajectories...`);
    setSimulatedSpinsCount(Math.round(totalTargetSpins * 0.70));

    // Stage 3
    await new Promise((r) => setTimeout(r, 340));
    setSimulationProgress(90);
    setSimulationStage('Calculating risk corridors & drawdown boundaries...');
    setSimulatedSpinsCount(totalTargetSpins);

    // Stage 4
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
      setSelectedSessionScope('overall');
      setActiveAnalysisTab('overview');

      // Async backend sync
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

  // AI Advisor Interactive Handlers (for tab view)
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
  };

  // Natural Language Strategy Applier
  const handleApplyNLStrategy = (data: {
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
  }) => {
    if (data.parameters.bankroll) setBankroll(String(data.parameters.bankroll));
    if (data.parameters.total_spins) setTotalSpins(String(data.parameters.total_spins));
    if (data.parameters.total_sessions) setTotalSessions(String(data.parameters.total_sessions));
    if (data.parameters.stop_loss !== undefined) setStopLoss(data.parameters.stop_loss ? String(data.parameters.stop_loss) : '');
    if (data.parameters.target_profit !== undefined) setTargetProfit(data.parameters.target_profit ? String(data.parameters.target_profit) : '');
    if (Array.isArray(data.conditions) && data.conditions.length > 0) {
      setConditions(data.conditions);
    }
    setIsNLModalOpen(false);
  };

  // CSV Export Handlers
  const handleExportSessionsCSV = () => {
    if (!results || !results.sessions || results.sessions.length === 0) return;
    const headers = ['Session #', 'Completed Spins', 'Exit Reason', 'Initial Bankroll', 'Final Bankroll', 'Net Profit', 'ROI %', 'Peak Bankroll', 'Lowest Bankroll', 'Max Drawdown', 'Total Wins', 'Total Losses', 'Pushes'];
    const rows = results.sessions.map((s) => [s.sessionIndex, s.completedSpins, `"${(s.stopReason || 'Completed Max Spins').replace(/"/g, '""')}"`, s.initialBankroll.toFixed(2), s.finalBankroll.toFixed(2), s.netProfit.toFixed(2), s.roiPercent.toFixed(2), s.peakBankroll.toFixed(2), s.lowestBankroll.toFixed(2), s.maxDrawdown.toFixed(2), s.totalWins, s.totalLosses, s.pushes]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `table_edge_sessions_${(selectedStrategy?.name || 'strategy').toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!results || activeHistory.length <= 1) return;
    const sNum = results.totalSessions > 1 ? (inspectedSession?.sessionIndex || 1) : 1;
    const headers = ['Session', 'Spin', 'Level', 'Multiplier', 'Wager', 'Pocket Rolled', 'Outcome', 'Payout', 'Net Win', 'Bankroll', 'Cumulative Profit', 'Condition Triggered', 'Action Taken', 'Next Level', 'Next Multiplier'];
    const rows = activeHistory.slice(1).map((pt) => [`Session #${sNum}`, pt.spin, `L${pt.level}`, `${pt.multiplier}x`, pt.wager.toFixed(2), pt.pocket !== undefined ? String(pt.pocket) : '-', pt.outcome.replace('_', ' ').toUpperCase(), pt.payout.toFixed(2), pt.netWin.toFixed(2), pt.balance.toFixed(2), pt.cumulativeProfit.toFixed(2), `"${(pt.conditionApplied || 'None').replace(/"/g, '""')}"`, `"${(pt.actionTaken || 'None').replace(/"/g, '""')}"`, `L${pt.nextLevel}`, `${pt.nextMultiplier}x`]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `table_edge_spins_${(selectedStrategy?.name || 'strategy').toLowerCase().replace(/[^a-z0-9]/gi, '_')}_session${sNum}_${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // High-DPI Canvas Rendering
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

    // Subtle Gridlines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (!results) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select strategy and click "Run Simulation"', w / 2, h / 2);
      return;
    }

    const initialBankroll = results.initialBankroll;
    const isMulti = results.totalSessions > 1;
    const GREEN = '#00ff87';
    const RED = '#ff3b30';
    const padY = 24;
    const padX = 16;

    const targetProfitNum = targetProfit ? parseFloat(targetProfit) : undefined;
    const stopLossNum = stopLoss ? parseFloat(stopLoss) : undefined;

    if (!isMulti) {
      const history = results.history;
      if (history.length === 0) return;
      const balances = history.map((p) => p.balance);
      let minBalance = Math.min(...balances, initialBankroll);
      let maxBalance = Math.max(...balances, initialBankroll);
      if (targetProfitNum && targetProfitNum > 0) {
        maxBalance = Math.max(maxBalance, initialBankroll + targetProfitNum);
      }
      if (stopLossNum && stopLossNum > 0) {
        minBalance = Math.min(minBalance, Math.max(0, initialBankroll - stopLossNum));
      }
      const range = maxBalance - minBalance || 1;

      const getY = (val: number) => h - padY - ((val - minBalance) / range) * (h - padY * 2);
      const getX = (idx: number) => padX + (idx / (history.length - 1 || 1)) * (w - padX * 2);
      const startY = getY(initialBankroll);

      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.moveTo(padX, startY); ctx.lineTo(w - padX, startY); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Base: ${currency.symbol}${initialBankroll.toLocaleString()}`, padX + 6, startY - 4);

      if (targetProfitNum && targetProfitNum > 0) {
        const tpY = getY(initialBankroll + targetProfitNum);
        if (tpY >= padY && tpY <= h - padY) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(0,255,135,0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(padX, tpY);
          ctx.lineTo(w - padX, tpY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(0,255,135,0.9)';
          ctx.font = '10px Inter, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`Target: +${currency.symbol}${targetProfitNum}`, w - padX - 4, tpY - 4);
        }
      }

      if (stopLossNum && stopLossNum > 0) {
        const slY = getY(initialBankroll - stopLossNum);
        if (slY >= padY && slY <= h - padY) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255,59,48,0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(padX, slY);
          ctx.lineTo(w - padX, slY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,59,48,0.9)';
          ctx.font = '10px Inter, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`Stop Loss: -${currency.symbol}${stopLossNum}`, w - padX - 4, slY - 4);
        }
      }

      const buildLinePath = () => {
        const path = new Path2D();
        history.forEach((pt, idx) => {
          const x = getX(idx); const y = getY(pt.balance);
          if (idx === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        return path;
      };

      const buildFillPath = () => {
        const path = new Path2D();
        history.forEach((pt, idx) => {
          const x = getX(idx); const y = getY(pt.balance);
          if (idx === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        path.lineTo(getX(history.length - 1), h - padY);
        path.lineTo(getX(0), h - padY);
        path.closePath();
        return path;
      };

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, startY); ctx.clip();
      const profitGrad = ctx.createLinearGradient(0, 0, 0, startY);
      profitGrad.addColorStop(0, 'rgba(0,255,135,0.18)'); profitGrad.addColorStop(1, 'rgba(0,255,135,0.0)');
      ctx.fillStyle = profitGrad; ctx.fill(buildFillPath()); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(0, startY, w, h - startY); ctx.clip();
      const lossGrad = ctx.createLinearGradient(0, startY, 0, h);
      lossGrad.addColorStop(0, 'rgba(255,59,48,0.0)'); lossGrad.addColorStop(1, 'rgba(255,59,48,0.18)');
      ctx.fillStyle = lossGrad; ctx.fill(buildFillPath()); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, startY + 1); ctx.clip();
      ctx.strokeStyle = GREEN; ctx.lineWidth = 2.2; ctx.stroke(buildLinePath()); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(0, startY - 1, w, h - startY + 1); ctx.clip();
      ctx.strokeStyle = RED; ctx.lineWidth = 2.2; ctx.stroke(buildLinePath()); ctx.restore();

      if (hoveredPoint) {
        const hx = getX(hoveredPoint.spin); const hy = getY(hoveredPoint.balance);
        const dotColor = hoveredPoint.balance >= initialBankroll ? GREEN : RED;
        ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1; ctx.moveTo(hx, padY); ctx.lineTo(hx, h - padY); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.fillStyle = dotColor; ctx.shadowColor = dotColor; ctx.shadowBlur = 12;
        ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      }
    } else {
      const sessions = results.sessions || [];
      let globalMin = Math.min(results.lowestBankroll, initialBankroll);
      let globalMax = Math.max(results.peakBankroll, initialBankroll);
      if (targetProfitNum && targetProfitNum > 0) {
        globalMax = Math.max(globalMax, initialBankroll + targetProfitNum);
      }
      if (stopLossNum && stopLossNum > 0) {
        globalMin = Math.min(globalMin, Math.max(0, initialBankroll - stopLossNum));
      }
      const range = globalMax - globalMin || 1;
      const getY = (val: number) => h - padY - ((val - globalMin) / range) * (h - padY * 2);
      const maxSpins = results.totalSpins;
      const getX = (spinIdx: number, sLen: number) => padX + (spinIdx / Math.max(maxSpins, sLen - 1 || 1)) * (w - padX * 2);
      const startY = getY(initialBankroll);

      ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1; ctx.moveTo(padX, startY); ctx.lineTo(w - padX, startY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`Base: ${currency.symbol}${initialBankroll.toLocaleString()}`, padX + 6, startY - 4);

      if (targetProfitNum && targetProfitNum > 0) {
        const tpY = getY(initialBankroll + targetProfitNum);
        if (tpY >= padY && tpY <= h - padY) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(0,255,135,0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(padX, tpY);
          ctx.lineTo(w - padX, tpY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(0,255,135,0.9)';
          ctx.font = '10px Inter, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`Target: +${currency.symbol}${targetProfitNum}`, w - padX - 4, tpY - 4);
        }
      }

      if (stopLossNum && stopLossNum > 0) {
        const slY = getY(initialBankroll - stopLossNum);
        if (slY >= padY && slY <= h - padY) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255,59,48,0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(padX, slY);
          ctx.lineTo(w - padX, slY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,59,48,0.9)';
          ctx.font = '10px Inter, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`Stop Loss: -${currency.symbol}${stopLossNum}`, w - padX - 4, slY - 4);
        }
      }

      if (selectedSessionScope === 'overall') {
        // Draw all session paths
        sessions.forEach((s) => {
          const traj = s.balanceTrajectory;
          if (!traj || traj.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = s.netProfit >= 0 ? 'rgba(0,255,135,0.25)' : 'rgba(255,59,48,0.25)';
          ctx.lineWidth = 1.2;
          traj.forEach((bal, idx) => {
            const x = getX(idx, traj.length); const y = getY(bal);
            if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        });

        // Compute and draw average trajectory across all sessions
        const maxLen = Math.max(...sessions.map((s) => s.balanceTrajectory?.length || 0));
        if (maxLen > 1) {
          const avgTraj: number[] = [];
          for (let step = 0; step < maxLen; step++) {
            const vals = sessions
              .map((s) => s.balanceTrajectory?.[Math.min(step, (s.balanceTrajectory?.length || 1) - 1)])
              .filter((v): v is number => typeof v === 'number');
            if (vals.length > 0) {
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              avgTraj.push(avg);
            }
          }
          if (avgTraj.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.shadowColor = '#00ff87';
            ctx.shadowBlur = 6;
            avgTraj.forEach((bal, idx) => {
              const x = getX(idx, avgTraj.length); const y = getY(bal);
              if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      } else {
        // Individual session highlighted
        sessions.forEach((s) => {
          if (s.sessionIndex === inspectedSessionIndex) return;
          const traj = s.balanceTrajectory;
          if (!traj || traj.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = s.netProfit >= 0 ? 'rgba(0,255,135,0.08)' : 'rgba(255,59,48,0.08)';
          ctx.lineWidth = 1;
          traj.forEach((bal, idx) => {
            const x = getX(idx, traj.length); const y = getY(bal);
            if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        });

        const targetSession = inspectedSession;
        if (targetSession && targetSession.balanceTrajectory && targetSession.balanceTrajectory.length > 1) {
          const traj = targetSession.balanceTrajectory;
          ctx.beginPath();
          ctx.strokeStyle = targetSession.netProfit >= 0 ? GREEN : RED;
          ctx.lineWidth = 2.5; ctx.shadowColor = targetSession.netProfit >= 0 ? GREEN : RED; ctx.shadowBlur = 8;
          traj.forEach((bal, idx) => {
            const x = getX(idx, traj.length); const y = getY(bal);
            if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke(); ctx.shadowBlur = 0;
        }
      }

      if (hoveredPoint) {
        const trajLen = (selectedSessionScope !== 'overall' && inspectedSession?.balanceTrajectory)
          ? inspectedSession.balanceTrajectory.length
          : maxSpins;
        const hx = getX(hoveredPoint.spin, trajLen); const hy = getY(hoveredPoint.balance);
        const dotColor = hoveredPoint.balance >= initialBankroll ? GREEN : RED;
        ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1; ctx.moveTo(hx, padY); ctx.lineTo(hx, h - padY); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.fillStyle = dotColor; ctx.shadowColor = dotColor; ctx.shadowBlur = 12;
        ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }, [results, hoveredPoint, inspectedSessionIndex, inspectedSession, selectedSessionScope, currency, targetProfit, stopLoss]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!results || activeHistory.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const padX = 16;
    const ratio = Math.max(0, Math.min(1, (x - padX) / (w - padX * 2)));
    const idx = Math.round(ratio * (activeHistory.length - 1));
    if (activeHistory[idx]) setHoveredPoint(activeHistory[idx]);
  };

  // Comprehensive 40+ Analytical Calculations with strict formatting and scope awareness
  const analyticsCalculations = useMemo(() => {
    if (!results) return null;

    const isIndividualSession = selectedSessionScope !== 'overall' && results.totalSessions > 1;
    const sessionTarget = isIndividualSession
      ? (inspectedSession || results.sessions?.find((s) => s.sessionIndex === selectedSessionScope) || results.sessions[0])
      : null;

    const spinsList = activeHistory.slice(1);
    const completed = sessionTarget ? sessionTarget.completedSpins : (results.completedSpins || Math.max(1, spinsList.length));

    const netProfit = sessionTarget ? sessionTarget.netProfit : results.netProfit;
    const roiPercent = sessionTarget ? sessionTarget.roiPercent : results.roiPercent;
    const finalBankroll = sessionTarget ? sessionTarget.finalBankroll : results.finalBankroll;
    const peakBankroll = sessionTarget ? sessionTarget.peakBankroll : results.peakBankroll;
    const lowestBankroll = sessionTarget ? sessionTarget.lowestBankroll : results.lowestBankroll;
    const maxDrawdown = sessionTarget ? sessionTarget.maxDrawdown : results.maxDrawdown;
    const maxDrawdownPercent = sessionTarget
      ? (sessionTarget.peakBankroll > 0 ? (sessionTarget.maxDrawdown / sessionTarget.peakBankroll) * 100 : 0)
      : results.maxDrawdownPercent;

    const totalWins = sessionTarget ? sessionTarget.totalWins : results.totalWins;
    const totalLosses = sessionTarget ? sessionTarget.totalLosses : results.totalLosses;
    const pushes = sessionTarget ? sessionTarget.pushes : results.pushes;
    const winRate = sessionTarget ? (completed > 0 ? (totalWins / completed) * 100 : 0) : results.winRate;
    const lossRate = sessionTarget ? (completed > 0 ? (totalLosses / completed) * 100 : 0) : results.lossRate;

    const maxWins = sessionTarget
      ? (sessionTarget.maxWins ?? spinsList.filter((p) => p.outcome === 'max_win').length)
      : results.maxWins;
    const partialWins = sessionTarget
      ? (sessionTarget.partialWins ?? spinsList.filter((p) => p.outcome === 'partial_win').length)
      : results.partialWins;
    const partialLosses = sessionTarget
      ? (sessionTarget.partialLosses ?? spinsList.filter((p) => p.outcome === 'partial_loss').length)
      : results.partialLosses;

    // Gross cashflow metrics
    const grossWins = spinsList.length > 0 && spinsList.some((p) => p.netWin > 0)
      ? spinsList.filter((p) => p.netWin > 0).reduce((acc, p) => acc + p.netWin, 0)
      : (sessionTarget ? Math.max(0, netProfit) : results.totalWins * (results.avgWin || 0));

    const grossLosses = spinsList.length > 0 && spinsList.some((p) => p.netWin < 0)
      ? spinsList.filter((p) => p.netWin < 0).reduce((acc, p) => acc + Math.abs(p.netWin), 0)
      : (sessionTarget ? Math.max(0, -netProfit) : results.totalLosses * Math.abs(results.avgLoss || 0));

    const avgWin = sessionTarget
      ? (totalWins > 0 ? grossWins / totalWins : 0)
      : (results.avgWin || 0);

    const avgLoss = sessionTarget
      ? (totalLosses > 0 ? -(grossLosses / totalLosses) : 0)
      : (results.avgLoss || 0);
    const avgLossAbs = Math.abs(avgLoss);

    const longestWinStreak = sessionTarget
      ? (sessionTarget.longestWinStreak ?? 0)
      : results.longestWinStreak;
    const longestLossStreak = sessionTarget
      ? (sessionTarget.longestLossStreak ?? 0)
      : results.longestLossStreak;

    const totalWagered = sessionTarget
      ? (sessionTarget.totalWagered ?? (spinsList.length > 0 ? spinsList.reduce((acc, p) => acc + p.wager, 0) : 0))
      : results.totalWagered;

    const avgBetSize = completed > 0 ? totalWagered / completed : (results.avgBetSize || 0);
    const maxBetSize = sessionTarget
      ? (sessionTarget.maxBetSize ?? (spinsList.length > 0 ? Math.max(...spinsList.map((p) => p.wager)) : 0))
      : results.maxBetSize;

    const profitFactor = grossLosses > 0
      ? grossWins / grossLosses
      : (grossWins > 0 ? 99.9 : 0);

    const expectancyPerSpin = completed > 0
      ? netProfit / completed
      : (results.expectancyPerSpin || 0);

    const payoffRatio = avgLossAbs > 0 ? avgWin / avgLossAbs : 0;
    const breakEvenWinRate = avgWin + avgLossAbs > 0 ? (avgLossAbs / (avgWin + avgLossAbs)) * 100 : 0;
    const edgeMargin = parseFloat((winRate - breakEvenWinRate).toFixed(1));

    const mfe = Math.max(0, peakBankroll - results.initialBankroll);
    const mae = Math.max(0, results.initialBankroll - lowestBankroll);
    const lowestCushion = results.initialBankroll > 0 ? (lowestBankroll / results.initialBankroll) * 100 : 0;
    const turnoverVelocity = results.initialBankroll > 0 ? totalWagered / results.initialBankroll : 0;
    const realizedHouseEdge = totalWagered > 0 ? -(netProfit / totalWagered) * 100 : 0;
    const theoreticalHouseEdge = rules === 'american' ? 5.26 : 2.70;
    const calmarRatio = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;
    const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : (netProfit > 0 ? 99.9 : 0);

    const bestSingleWin = spinsList.length > 0 ? Math.max(...spinsList.map((p) => p.netWin)) : Math.max(0, netProfit);
    const worstSingleLoss = spinsList.length > 0 ? Math.min(...spinsList.map((p) => p.netWin)) : Math.min(0, netProfit);

    // Underwater period
    let maxUnderwater = 0;
    let currentUnderwater = 0;
    let runningPeak = results.initialBankroll;
    const trajToInspect = sessionTarget?.balanceTrajectory || spinsList.map((p) => p.balance);
    for (const bal of trajToInspect) {
      if (bal > runningPeak) {
        runningPeak = bal;
        currentUnderwater = 0;
      } else {
        currentUnderwater++;
        if (currentUnderwater > maxUnderwater) maxUnderwater = currentUnderwater;
      }
    }

    // Progression escalation metrics
    const avgMultiplier = spinsList.length > 0
      ? spinsList.reduce((acc, p) => acc + p.multiplier, 0) / spinsList.length
      : 1.0;
    const maxMultiplier = spinsList.length > 0
      ? Math.max(...spinsList.map((p) => p.multiplier))
      : 1.0;
    const escalatedSpins = spinsList.filter((p) => p.level > 1 || p.multiplier > 1).length;
    const escalationRate = spinsList.length > 0 ? (escalatedSpins / spinsList.length) * 100 : 0;
    const rulesFiredCount = spinsList.filter((p) => p.conditionApplied).length;

    // Capital survival buffer
    const survivalSpinsAtAvgLoss = avgLossAbs > 0 ? Math.floor(finalBankroll / avgLossAbs) : 999;
    const netYieldOnWager = totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0;

    // Standard deviation and downside risk
    const meanReturn = expectancyPerSpin;
    const variance = spinsList.length > 1
      ? spinsList.reduce((acc, p) => acc + Math.pow(p.netWin - meanReturn, 2), 0) / (spinsList.length - 1)
      : 0;
    const stdevReturns = Math.sqrt(variance);

    const downsideVariance = spinsList.length > 1
      ? spinsList.filter((p) => p.netWin < 0).reduce((acc, p) => acc + Math.pow(p.netWin, 2), 0) / (spinsList.length - 1)
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideDeviation > 0 ? (meanReturn / downsideDeviation) * Math.sqrt(completed) : 0;
    const sharpeRatio = stdevReturns > 0 ? (meanReturn / stdevReturns) * Math.sqrt(completed) : 0;

    const mostActiveLevel = results.levelStats.length > 0
      ? results.levelStats.reduce((a, b) => a.spinsCount > b.spinsCount ? a : b, results.levelStats[0])
      : null;

    const mostProfitableLevel = results.levelStats.length > 0
      ? results.levelStats.reduce((a, b) => a.netProfit > b.netProfit ? a : b, results.levelStats[0])
      : null;

    return {
      isIndividualSession,
      sessionTarget,
      netProfit,
      roiPercent,
      finalBankroll,
      peakBankroll,
      lowestBankroll,
      maxDrawdown,
      maxDrawdownPercent,
      completedSpins: completed,
      winRate,
      lossRate,
      totalWins,
      totalLosses,
      pushes,
      maxWins,
      partialWins,
      partialLosses,
      avgWin,
      avgLoss,
      longestWinStreak,
      longestLossStreak,
      totalWagered,
      avgBetSize,
      maxBetSize,
      profitFactor,
      expectancyPerSpin,
      payoffRatio,
      breakEvenWinRate,
      edgeMargin,
      mfe,
      mae,
      lowestCushion,
      turnoverVelocity,
      realizedHouseEdge,
      theoreticalHouseEdge,
      calmarRatio,
      recoveryFactor,
      grossWins,
      grossLosses,
      bestSingleWin,
      worstSingleLoss,
      maxUnderwater,
      avgMultiplier,
      maxMultiplier,
      escalatedSpins,
      escalationRate,
      rulesFiredCount,
      survivalSpinsAtAvgLoss,
      netYieldOnWager,
      stdevReturns,
      downsideDeviation,
      sortinoRatio,
      sharpeRatio,
      mostActiveLevel,
      mostProfitableLevel,
    };
  }, [results, activeHistory, rules, selectedSessionScope, inspectedSession]);

  const inputCls = 'bg-transparent border-b border-white/20 focus:border-[#00ff87]/70 px-2 py-1.5 text-base font-semibold text-white outline-none w-full text-right placeholder-gray-600 transition-colors';
  const tabCls = (active: boolean) =>
    `px-3 pb-2 pt-1 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
      active ? 'border-[#00ff87] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-[#060a08] text-white flex flex-col font-sans select-none">

      {/* ════════════ TOP BAR ════════════ */}
      <header className="h-14 bg-[#060a08] border-b border-white/[0.08] px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={onBackToHub}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition border border-white/10 hover:border-white/20 rounded-lg"
              title="Return to Hub"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hub</span>
            </button>
            <span className="text-gray-700 text-xs mx-0.5">/</span>
            <button
              onClick={onBackToTable}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition border border-white/10 hover:border-white/20 rounded-lg"
              title="Return to Roulette Table"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00ff87]" />
            <h1 className="text-sm font-bold text-white">
              Strategy Studio <span className="text-gray-500 font-normal text-xs">· Monte Carlo Lab</span>
            </h1>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* AI Modals Triggers in Top Bar */}
          <button
            type="button"
            onClick={() => setIsNLModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 hover:border-[#00ff87]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
            title="Open Natural Language Strategy Architect Window"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00ff87]" />
            <span>NL Architect</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAIAdvisorModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 hover:border-[#00ff87]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
            title="Open AI Winning Condition Advisor"
          >
            <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
            <span>AI Advisor</span>
          </button>

          {/* Presets */}
          <div className="relative" ref={presetsRef}>
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 hover:border-white/20 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {showPresets && (
              <div className="absolute right-0 mt-2 w-80 bg-[#080d0a] border border-white/15 rounded-lg shadow-2xl p-1.5 z-50">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block px-2.5 py-1.5">Preset Automations</span>
                <div className="space-y-0.5">
                  {PRESET_STRATEGY_CONDITIONS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p.name)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-white/[0.06] transition"
                    >
                      <div className="text-xs font-semibold text-gray-200">{p.name}</div>
                      <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reset */}
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-white/10 hover:border-red-500/30 text-gray-500 hover:text-red-400 text-xs font-medium rounded-lg transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Run Simulation */}
          <button
            onClick={handleRunSimulation}
            disabled={isRunning || !selectedStrategyId}
            className="flex items-center gap-2 px-5 py-2 bg-[#00ff87] hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-xs sm:text-sm rounded-lg transition cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Simulating ({simulationProgress}%)…</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-black" />
                <span>Run Simulation</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ════════════ ERROR BANNER ════════════ */}
      {errorMessage && (
        <div className="bg-red-950/60 border-b border-red-500/30 px-6 py-2 flex items-center justify-between text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-semibold ml-4">Dismiss</button>
        </div>
      )}

      {/* ════════════ 40% - 60% WORKSPACE SPLIT ════════════ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* ─────── LEFT COLUMN: CONFIGURATION (40% WIDTH) ─────── */}
        <div className="w-full lg:w-[40%] border-r border-white/[0.08] flex flex-col min-h-0 bg-[#060a08] overflow-y-auto shrink-0">

          {/* § 1 — Strategy Selector */}
          <section className="px-6 py-5 border-b border-white/[0.07]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Progression Strategy</h3>
            <CustomSelect
              value={selectedStrategyId}
              options={strategySelectOptions}
              onChange={(val) => {
                setSelectedStrategyId(String(val));
                setResults(null);
                setErrorMessage(null);
              }}
              placeholder="— Choose a strategy to simulate —"
              className="w-full"
            />
            {activeLevels.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {activeLevels.length} active level{activeLevels.length !== 1 ? 's' : ''} · Base wager:{' '}
                <span className="text-white font-semibold">{currency.symbol}{activeLevels[0]?.totalWager || 0}</span>
              </p>
            )}
          </section>

          {/* § 2 — Execution Parameters */}
          <section className="px-6 py-5 border-b border-white/[0.07]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Execution Parameters</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">Starting Bankroll</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-sm shrink-0">{currency.symbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1000"
                    value={bankroll}
                    onChange={(e) => setBankroll(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">Sessions (N)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 10"
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(e.target.value.replace(/[^0-9]/g, ''))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">Spins / Session</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 100"
                  value={totalSpins}
                  onChange={(e) => setTotalSpins(e.target.value.replace(/[^0-9]/g, ''))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">Take Profit <span className="text-gray-500 font-normal">(optional)</span></label>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500 text-sm shrink-0">+{currency.symbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 200"
                    value={targetProfit}
                    onChange={(e) => setTargetProfit(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls}
                  />
                </div>
                {targetProfit && Number(targetProfit) > 0 && bankroll && Number(bankroll) > 0 && (
                  <p className="text-xs text-emerald-400 font-mono mt-1 text-right">
                    exits at {currency.symbol}{(Number(bankroll) + Number(targetProfit)).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1 font-medium">Stop Loss <span className="text-gray-500 font-normal">(optional)</span></label>
                <div className="flex items-center gap-1.5">
                  <span className="text-red-500 text-sm shrink-0">−{currency.symbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 500"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={inputCls}
                  />
                </div>
                {stopLoss && Number(stopLoss) > 0 && bankroll && Number(bankroll) > 0 && (
                  <p className="text-xs text-red-400 font-mono mt-1 text-right">
                    exits at {currency.symbol}{Math.max(0, Number(bankroll) - Number(stopLoss)).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* § 3 — Payout & Trigger Guide */}
          {outcomeInfo && (
            <section className="px-6 py-4 border-b border-white/[0.07]">
              <button
                type="button"
                onClick={() => setShowOutcomeGuide(!showOutcomeGuide)}
                className="w-full flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-gray-200 transition" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-gray-200 transition">
                    Payout &amp; Trigger Guide
                  </span>
                  <span className="text-xs text-gray-500">({rules} Roulette · L1)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono">Base {currency.symbol}{outcomeInfo.totalWager}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showOutcomeGuide ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showOutcomeGuide && (
                <div className="mt-4 space-y-0">
                  <div className="flex items-center gap-6 text-xs text-gray-400 pb-3 border-b border-white/[0.06]">
                    <span>Base Wager: <b className="text-gray-200">{currency.symbol}{outcomeInfo.totalWager.toFixed(2)}</b></span>
                    <span>Max Payout: <b className="text-gray-200">{currency.symbol}{outcomeInfo.maxPayout.toFixed(2)}</b></span>
                    <span>Max Net Win: <b className="text-[#00ff87]">+{currency.symbol}{outcomeInfo.maxWinNet.toFixed(2)}</b></span>
                  </div>

                  {outcomeInfo.isUniformPayout && (
                    <div className="border-l-2 border-amber-500 pl-3 py-2 my-3">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          <strong className="text-amber-300">Uniform Payout:</strong> All {outcomeInfo.maxWinPockets.length} winning pockets pay {currency.symbol}{outcomeInfo.maxWinPayout.toFixed(2)} — no Partial Wins on this layout. Use <strong>"Any Win"</strong> or <strong>"Max Win"</strong> in rules.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-0">
                    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05]">
                      <div className="w-0.5 self-stretch rounded-full bg-[#00ff87] shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-[#00ff87] w-24 shrink-0">Max Win <span className="text-gray-500 font-normal">({outcomeInfo.maxWinPockets.length})</span></span>
                      <span className="text-xs text-gray-300 flex-1 leading-relaxed font-mono">{outcomeInfo.maxWinPockets.join(', ') || 'None'}</span>
                      <span className="text-xs font-mono text-[#00ff87] shrink-0 font-bold">+{currency.symbol}{outcomeInfo.maxWinNet.toFixed(2)}</span>
                    </div>

                    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05]">
                      <div className="w-0.5 self-stretch rounded-full bg-blue-400 shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-blue-400 w-24 shrink-0">Part Win <span className="text-gray-500 font-normal">({outcomeInfo.partialWinPockets.length})</span></span>
                      <span className="text-xs text-gray-300 flex-1 leading-relaxed font-mono">
                        {outcomeInfo.partialWinPockets.length > 0 ? outcomeInfo.partialWinPockets.join(', ') : <span className="italic text-gray-500">0 pockets — all wins are max tier</span>}
                      </span>
                      <span className="text-xs font-mono text-blue-400 shrink-0 font-bold">
                        {outcomeInfo.partialWinPockets.length > 0
                          ? (outcomeInfo.partialWinMinNet === outcomeInfo.partialWinMaxNet
                            ? `+${currency.symbol}${outcomeInfo.partialWinMinNet.toFixed(2)}`
                            : `+${currency.symbol}${outcomeInfo.partialWinMinNet.toFixed(2)}–${currency.symbol}${outcomeInfo.partialWinMaxNet.toFixed(2)}`)
                          : '—'}
                      </span>
                    </div>

                    {outcomeInfo.pushPockets.length > 0 && (
                      <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05]">
                        <div className="w-0.5 self-stretch rounded-full bg-gray-500 shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-gray-400 w-24 shrink-0">Push <span className="text-gray-500 font-normal">({outcomeInfo.pushPockets.length})</span></span>
                        <span className="text-xs text-gray-300 flex-1 leading-relaxed font-mono">{outcomeInfo.pushPockets.join(', ')}</span>
                        <span className="text-xs font-mono text-gray-400 shrink-0">±0.00</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05]">
                      <div className="w-0.5 self-stretch rounded-full bg-orange-400 shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-orange-400 w-24 shrink-0">Part Loss <span className="text-gray-500 font-normal">({outcomeInfo.partialLossPockets.length})</span></span>
                      <span className="text-xs text-gray-300 flex-1 leading-relaxed font-mono">
                        {outcomeInfo.partialLossPockets.length > 0 ? outcomeInfo.partialLossPockets.join(', ') : <span className="italic text-gray-500">0 pockets</span>}
                      </span>
                      <span className="text-xs font-mono text-orange-400 shrink-0 font-bold">
                        {outcomeInfo.partialLossPockets.length > 0
                          ? (outcomeInfo.partialLossMinNet === outcomeInfo.partialLossMaxNet
                            ? `-${currency.symbol}${Math.abs(outcomeInfo.partialLossMinNet).toFixed(2)}`
                            : `-${currency.symbol}${Math.abs(outcomeInfo.partialLossMaxNet).toFixed(2)}–${currency.symbol}${Math.abs(outcomeInfo.partialLossMinNet).toFixed(2)}`)
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 py-2.5">
                      <div className="w-0.5 self-stretch rounded-full bg-[#ff3b30] shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-[#ff3b30] w-24 shrink-0">Total Loss <span className="text-gray-500 font-normal">({outcomeInfo.totalLossPockets.length})</span></span>
                      <span className="text-xs text-gray-300 flex-1 leading-relaxed font-mono">{outcomeInfo.totalLossPockets.join(', ') || 'None'}</span>
                      <span className="text-xs font-mono text-[#ff3b30] shrink-0 font-bold">−{currency.symbol}{outcomeInfo.totalWager.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* § 4 — Dedicated AI Tools Bar (Opens in Modals, NOT auto-expanded) */}
          <section className="px-6 py-4 border-b border-white/[0.07] bg-white/[0.01]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">AI Strategy Assistants</span>
                <p className="text-xs text-gray-400 mt-0.5">Parse natural language ideas or generate winning rules</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNLModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white border border-white/10 rounded-lg text-xs font-semibold transition cursor-pointer"
                  title="Open Natural Language Strategy Architect Window"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00ff87]" />
                  <span>NL Architect</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAIAdvisorModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white border border-white/10 rounded-lg text-xs font-semibold transition cursor-pointer"
                  title="Open AI Condition Optimizer Window"
                >
                  <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
                  <span>Advisor</span>
                </button>
              </div>
            </div>
          </section>

          {/* § 5 — Automation Rules Pipeline (Flat Document Flow) */}
          <section className="px-6 py-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Automation Rules{conditions.length > 0 ? ` (${conditions.length})` : ''}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">Rules execute in sequence each spin to control progression</p>
              </div>
              {conditions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConditions([])}
                  className="text-xs text-gray-500 hover:text-red-400 transition cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="mt-2">
              <WorkflowPipeline
                conditions={conditions}
                totalLevels={activeLevels.length}
                currencySymbol={currency.symbol}
                onAdd={handleAddCondition}
                onUpdate={handleUpdateCondition}
                onDelete={handleRemoveCondition}
                onDuplicate={handleDuplicateCondition}
              />
            </div>
          </section>
        </div>

        {/* ─────── RIGHT COLUMN: VISUALIZER & COMPREHENSIVE ANALYTICS (60% WIDTH) ─────── */}
        <div className="w-full lg:w-[60%] flex flex-col min-h-0 bg-[#070c09] overflow-hidden relative">

          {/* Trajectory Canvas & Top Overview Bar */}
          <div className="px-6 pt-5 pb-2 shrink-0 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">
                {results?.totalSessions && results.totalSessions > 1
                  ? selectedSessionScope === 'overall'
                    ? `Portfolio Trajectory Envelope · All ${results.totalSessions} Sessions Combined`
                    : `Session #${selectedSessionScope} Trajectory · ${inspectedSession?.completedSpins || 0} Spins`
                  : 'Balance Trajectory'}
              </span>

              <div className="flex items-center gap-3">
                {hoveredPoint ? (
                  <div className="flex items-center gap-2.5 text-xs font-mono">
                    <span className="text-gray-400">Spin #{hoveredPoint.spin}</span>
                    <span className={hoveredPoint.balance >= (results?.initialBankroll || 0) ? 'text-[#00ff87] font-bold' : 'text-[#ff3b30] font-bold'}>
                      {currency.symbol}{hoveredPoint.balance.toLocaleString()}
                    </span>
                    <span className="text-gray-400">L{hoveredPoint.level} ×{hoveredPoint.multiplier}</span>
                    <span className={hoveredPoint.netWin >= 0 ? 'text-[#00ff87] font-bold' : 'text-[#ff3b30] font-bold'}>
                      {hoveredPoint.netWin >= 0 ? `+${currency.symbol}${hoveredPoint.netWin.toFixed(1)}` : `-${currency.symbol}${Math.abs(hoveredPoint.netWin).toFixed(1)}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">Hover canvas to inspect spin telemetry</span>
                )}

                {/* Open Spin Log Drawer Button */}
                {results && (
                  <button
                    type="button"
                    onClick={() => setIsSpinDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-[#00ff87]/20 border border-white/15 hover:border-[#00ff87]/40 text-gray-200 hover:text-[#00ff87] text-xs font-bold rounded transition cursor-pointer"
                    title="Open Detailed Spin-by-Spin Audit Log"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#00ff87]" />
                    <span>Spin Log ({activeHistory.length - 1})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-44 bg-[#030604] overflow-hidden relative">
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
                className="w-full h-full cursor-crosshair block"
              />
              {isRunning && (
                <div className="absolute inset-0 bg-[#060a08]/92 flex flex-col items-center justify-center p-4 z-20 space-y-3">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-[#00ff87] animate-spin" />
                    <Activity className="w-4 h-4 text-[#00ff87] animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xs font-mono font-bold text-white flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-ping" />
                      <span>{simulationStage}</span>
                    </div>
                    <div className="text-xs font-mono text-emerald-400">
                      {simulatedSpinsCount.toLocaleString()} spins ({simulationProgress}%)
                    </div>
                  </div>
                  <div className="w-44 h-1 bg-black/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-[#00ff87] rounded-full transition-all duration-150"
                      style={{ width: `${simulationProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Exit / Status Banner */}
            {results && (
              results.totalSessions > 1 && selectedSessionScope !== 'overall' && inspectedSession ? (
                <div className={`border-l-2 pl-3 py-1.5 mt-2 text-xs flex items-center justify-between ${
                  inspectedSession.stopReason === 'Stop Loss Hit'
                    ? 'border-red-500 text-red-300'
                    : inspectedSession.stopReason === 'Target Profit Reached'
                    ? 'border-[#00ff87] text-emerald-300'
                    : 'border-white/20 text-gray-300'
                }`}>
                  <div>
                    <span className="font-bold">
                      Session #{inspectedSession.sessionIndex}: {inspectedSession.stopReason || 'Completed Max Spins'}
                    </span>
                    <span className="text-xs opacity-80 ml-2">
                      {inspectedSession.completedSpins} spins · Final: {currency.symbol}{inspectedSession.finalBankroll.toLocaleString()} ({inspectedSession.netProfit >= 0 ? '+' : ''}{currency.symbol}{inspectedSession.netProfit.toFixed(2)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionScope('overall')}
                    className="text-xs text-[#00ff87] hover:underline font-bold ml-3 cursor-pointer"
                  >
                    View Overall Portfolio →
                  </button>
                </div>
              ) : results.stoppedEarly ? (
                <div className={`border-l-2 pl-3 py-1.5 mt-2 text-xs ${
                  results.stopReason === 'Stop Loss Hit'
                    ? 'border-red-500 text-red-300'
                    : results.stopReason === 'Target Profit Reached'
                    ? 'border-[#00ff87] text-emerald-300'
                    : 'border-amber-400 text-amber-300'
                }`}>
                  <span className="font-bold">
                    {results.stopReason === 'Stop Loss Hit' ? '🛑 Stop Loss Hit' : results.stopReason === 'Target Profit Reached' ? '🎯 Target Profit Reached' : `⚠️ ${results.stopReason || 'Halted Early'}`}
                  </span>
                  <span className="text-xs opacity-80 ml-2">
                    {results.totalSessions === 1
                      ? `Terminated at Spin #${results.completedSpins} · Final: ${currency.symbol}${results.finalBankroll.toLocaleString()}`
                      : `${results.stopLossHits} SL exits (${results.stopLossHitRate}%) · ${results.targetProfitHits} TP exits (${results.targetProfitHitRate}%)`}
                  </span>
                </div>
              ) : (
                <div className="border-l-2 border-white/15 pl-3 py-1 mt-2 text-xs text-gray-400">
                  🏁{' '}
                  {results.totalSessions === 1
                    ? `Completed all ${results.completedSpins} spins`
                    : `All ${results.totalSessions} sessions completed`}
                  <span className="ml-2 font-mono text-gray-300 font-semibold">{results.completedSpins} spins total</span>
                </div>
              )
            )}

            {/* Multi-Session Win/Loss Bar */}
            {results && results.totalSessions > 1 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">
                    <span className="text-[#00ff87] font-bold">{results.sessionsWon}W ({results.sessionWinRate}%)</span>
                    {results.sessionsBreakeven > 0 && <span className="text-gray-400 ml-2">· {results.sessionsBreakeven}E</span>}
                    <span className="text-[#ff3b30] font-bold ml-2">· {results.sessionsLost}L ({((results.sessionsLost / results.totalSessions) * 100).toFixed(1)}%)</span>
                  </span>
                  <span className="text-gray-400 text-xs font-mono">
                    TP:{results.targetProfitHits} SL:{results.stopLossHits} Bust:{results.bustCount}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                  <div style={{ width: `${(results.sessionsWon / results.totalSessions) * 100}%` }} className="bg-[#00ff87] h-full" />
                  <div style={{ width: `${(results.sessionsBreakeven / results.totalSessions) * 100}%` }} className="bg-gray-500 h-full" />
                  <div style={{ width: `${(results.sessionsLost / results.totalSessions) * 100}%` }} className="bg-[#ff3b30] h-full" />
                </div>
              </div>
            )}
          </div>

          {/* ── Tab Strip ── */}
          <div className="px-6 flex items-center justify-between border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button type="button" onClick={() => setActiveAnalysisTab('overview')} className={tabCls(activeAnalysisTab === 'overview')}>
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {results?.totalSessions && results.totalSessions > 1
                    ? selectedSessionScope === 'overall'
                      ? `Overall Portfolio Analytics (${results.totalSessions} Sessions)`
                      : `Session #${selectedSessionScope} Analytics`
                    : 'Full Performance Analytics (40+ Metrics)'}
                </span>
              </button>
              {results && results.totalSessions > 1 && (
                <button type="button" onClick={() => setActiveAnalysisTab('sessions')} className={tabCls(activeAnalysisTab === 'sessions')}>
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Sessions ({results.totalSessions})</span>
                </button>
              )}
              <button type="button" onClick={() => setActiveAnalysisTab('levels')} className={tabCls(activeAnalysisTab === 'levels')}>
                Levels ({results ? results.levelStats.length : 0})
              </button>
              <button type="button" onClick={() => setActiveAnalysisTab('rules')} className={tabCls(activeAnalysisTab === 'rules')}>
                Rules ({results?.conditionStats?.length ?? 0})
              </button>
              <button type="button" onClick={() => setActiveAnalysisTab('advisor')} className={tabCls(activeAnalysisTab === 'advisor')}>
                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[#00ff87]" /> AI Diagnostic</span>
              </button>
            </div>

            {results && (
              <div className="flex items-center gap-3 pb-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSpinDrawerOpen(true)}
                  className="text-xs text-[#00ff87] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Open Spin Drawer</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Main Tab Content Area (Scrollable, Generous Space, Bigger Text, Non-overlapping Grids) ── */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 space-y-7">
            {results && analyticsCalculations ? (
              <>
                {/* ── Tab: Overview & 40+ Comprehensive Analytics Metrics ── */}
                {activeAnalysisTab === 'overview' && (
                  <div className="space-y-7 pb-8">

                    {/* ── Multi-Session Scope Controller ── */}
                    {results.totalSessions > 1 && (
                      <div className="pb-5 border-b border-white/[0.08] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#00ff87]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                              Analytics Scope:
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {bestSession && (
                              <button
                                type="button"
                                onClick={() => setSelectedSessionScope(bestSession.sessionIndex)}
                                className={`text-xs px-2.5 py-1 rounded transition cursor-pointer font-mono ${
                                  selectedSessionScope === bestSession.sessionIndex
                                    ? 'bg-[#00ff87]/20 border border-[#00ff87] text-[#00ff87] font-bold'
                                    : 'border border-white/10 text-gray-400 hover:text-[#00ff87] hover:border-[#00ff87]/40'
                                }`}
                              >
                                ★ Best: #{bestSession.sessionIndex} (+{currency.symbol}{bestSession.netProfit.toFixed(2)})
                              </button>
                            )}
                            {worstSession && (
                              <button
                                type="button"
                                onClick={() => setSelectedSessionScope(worstSession.sessionIndex)}
                                className={`text-xs px-2.5 py-1 rounded transition cursor-pointer font-mono ${
                                  selectedSessionScope === worstSession.sessionIndex
                                    ? 'bg-red-500/20 border border-red-500 text-red-400 font-bold'
                                    : 'border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/40'
                                }`}
                              >
                                Worst: #{worstSession.sessionIndex} ({currency.symbol}{worstSession.netProfit.toFixed(2)})
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scope Selector Options */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionScope('overall')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              selectedSessionScope === 'overall'
                                ? 'bg-[#00ff87] text-black shadow-md'
                                : 'border border-white/15 bg-white/[0.03] text-gray-300 hover:text-white hover:border-white/30'
                            }`}
                          >
                            <span className="font-extrabold">Overall Portfolio</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              selectedSessionScope === 'overall' ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'
                            }`}>
                              {results.totalSessions} Sessions
                            </span>
                          </button>

                          <div className="h-5 w-px bg-white/10 hidden sm:block" />

                          {/* Individual Session Dropdown */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400 font-medium">Inspect Session:</span>
                            <div className="relative">
                              <select
                                value={selectedSessionScope === 'overall' ? '' : selectedSessionScope}
                                onChange={(e) => {
                                  if (!e.target.value || e.target.value === 'overall') {
                                    setSelectedSessionScope('overall');
                                  } else {
                                    setSelectedSessionScope(Number(e.target.value));
                                  }
                                }}
                                className={`appearance-none bg-[#090f0c] border text-xs font-mono font-semibold pl-3 pr-8 py-1.5 rounded-lg outline-none cursor-pointer transition ${
                                  selectedSessionScope !== 'overall'
                                    ? 'border-[#00ff87] text-[#00ff87] bg-[#00ff87]/[0.06]'
                                    : 'border-white/15 text-gray-300 hover:border-white/30'
                                }`}
                              >
                                <option value="">— Select Individual Session —</option>
                                {results.sessions.map((s) => (
                                  <option key={s.sessionIndex} value={s.sessionIndex}>
                                    Session #{s.sessionIndex}: {s.netProfit >= 0 ? '+' : ''}${s.netProfit.toFixed(2)} ({s.stopReason || 'Completed'}) · {s.completedSpins} spins
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          {/* If individual session is selected: Steppers & Reset */}
                          {selectedSessionScope !== 'overall' && typeof selectedSessionScope === 'number' && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                disabled={selectedSessionScope <= 1}
                                onClick={() => setSelectedSessionScope(selectedSessionScope - 1)}
                                className="px-2.5 py-1 text-xs border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                title="Previous Session"
                              >
                                ← Prev
                              </button>
                              <span className="text-xs font-mono text-gray-400 px-1">
                                {selectedSessionScope} / {results.totalSessions}
                              </span>
                              <button
                                type="button"
                                disabled={selectedSessionScope >= results.totalSessions}
                                onClick={() => setSelectedSessionScope(selectedSessionScope + 1)}
                                className="px-2.5 py-1 text-xs border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                title="Next Session"
                              >
                                Next →
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSessionScope('overall')}
                                className="ml-2 text-xs text-[#00ff87] hover:underline font-bold transition cursor-pointer"
                              >
                                ✕ Reset to Overall
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Informative Session Context Bar */}
                        {selectedSessionScope !== 'overall' && inspectedSession && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-white/[0.05]">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-white text-sm">
                                Session #{inspectedSession.sessionIndex} Performance:
                              </span>
                              <span className={`font-mono font-bold text-sm ${inspectedSession.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                {inspectedSession.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(inspectedSession.netProfit).toFixed(2)}
                              </span>
                              <span className={`font-mono text-xs ${inspectedSession.roiPercent >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                ({inspectedSession.roiPercent >= 0 ? '+' : ''}{inspectedSession.roiPercent.toFixed(1)}% ROI)
                              </span>
                              <span className="text-gray-400">
                                · {inspectedSession.completedSpins} spins ({inspectedSession.stopReason || 'Completed'})
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setInspectedSessionIndex(inspectedSession.sessionIndex);
                                setIsSpinDrawerOpen(true);
                              }}
                              className="text-xs text-[#00ff87] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Inspect Session #{inspectedSession.sessionIndex} Spin Log</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Group 1: Capital Trajectory & Total Return */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Coins className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Capital Trajectory &amp; Total Returns
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Net Profit / Loss</span>
                          <span className={`text-xl sm:text-2xl font-black font-mono block truncate ${analyticsCalculations.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(analyticsCalculations.netProfit).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Final − Initial</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Return on Investment</span>
                          <span className={`text-xl sm:text-2xl font-black font-mono block truncate ${analyticsCalculations.roiPercent >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.roiPercent >= 0 ? '+' : ''}{analyticsCalculations.roiPercent.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">% of bankroll</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Final Bankroll</span>
                          <span className="text-xl sm:text-2xl font-black font-mono text-white block truncate">
                            {currency.symbol}{analyticsCalculations.finalBankroll.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Current balance</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Peak Bankroll</span>
                          <span className="text-xl sm:text-2xl font-bold font-mono text-[#00ff87] block truncate">
                            {currency.symbol}{analyticsCalculations.peakBankroll.toLocaleString()}
                          </span>
                          <span className="text-xs text-emerald-500/80 font-mono mt-0.5 block">High water mark</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Lowest Bankroll</span>
                          <span className="text-xl sm:text-2xl font-bold font-mono text-gray-300 block truncate">
                            {currency.symbol}{analyticsCalculations.lowestBankroll.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Trough point</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Drawdown</span>
                          <span className="text-xl sm:text-2xl font-black font-mono text-[#ff3b30] block truncate">
                            {currency.symbol}{analyticsCalculations.maxDrawdown.toLocaleString()}
                          </span>
                          <span className="text-xs text-red-400/80 font-mono mt-0.5 block">{analyticsCalculations.maxDrawdownPercent.toFixed(1)}% from peak</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 2: Gross Cashflow, Yield & Extremes */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Scale className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Gross Cashflow, Yield &amp; Single-Spin Extremes
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Gross Total Won</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#00ff87] block truncate">
                            +{currency.symbol}{analyticsCalculations.grossWins.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Sum of all winning payouts</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Gross Total Lost</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                            -{currency.symbol}{analyticsCalculations.grossLosses.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Sum of all lost wagers</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Net Yield on Turnover</span>
                          <span className={`text-lg sm:text-xl font-bold font-mono block truncate ${analyticsCalculations.netYieldOnWager >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.netYieldOnWager >= 0 ? '+' : ''}{analyticsCalculations.netYieldOnWager.toFixed(2)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Net Profit / Turnover</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Best Single Spin Gain</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#00ff87] block truncate">
                            +{currency.symbol}{analyticsCalculations.bestSingleWin.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Top single spin net win</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Worst Single Spin Loss</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                            {analyticsCalculations.worstSingleLoss < 0 ? '-' : ''}{currency.symbol}{Math.abs(analyticsCalculations.worstSingleLoss).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Largest single spin hit</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 3: Streaks & Mathematical Edge */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <TrendingUp className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Streaks, Averages &amp; Mathematical Edge
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Average Win Amount</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#00ff87] block truncate">
                            +{currency.symbol}{analyticsCalculations.avgWin.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">per winning spin</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Average Loss Amount</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                            -{currency.symbol}{Math.abs(analyticsCalculations.avgLoss).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">per losing spin</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Longest Win Streak</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-[#00ff87] block truncate">
                            {analyticsCalculations.longestWinStreak} <span className="text-xs font-normal text-gray-400">spins</span>
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">consecutive wins</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Longest Loss Streak</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-[#ff3b30] block truncate">
                            {analyticsCalculations.longestLossStreak} <span className="text-xs font-normal text-gray-400">spins</span>
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">consecutive losses</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Profit Factor</span>
                          <span className={`text-lg sm:text-xl font-black font-mono block truncate ${analyticsCalculations.profitFactor >= 1 ? 'text-[#00ff87]' : 'text-gray-300'}`}>
                            {analyticsCalculations.profitFactor.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Gross Win / Gross Loss</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Expectancy / Spin</span>
                          <span className={`text-lg sm:text-xl font-bold font-mono block truncate ${analyticsCalculations.expectancyPerSpin >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.expectancyPerSpin >= 0 ? '+' : ''}{currency.symbol}{analyticsCalculations.expectancyPerSpin.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Net yield per spin</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 4: Payoff Ratio & Probability Benchmarking (Cleanly spaced, safe formatted) */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Percent className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Payoff Dynamics &amp; Break-Even Benchmarks
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Payoff Ratio</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {analyticsCalculations.payoffRatio > 0 ? `${analyticsCalculations.payoffRatio.toFixed(2)}:1` : '—'}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Avg Win / Avg Loss</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Break-Even Win Rate</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-300 block truncate">
                            {analyticsCalculations.breakEvenWinRate.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Required to profit</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Edge Margin</span>
                          <span className={`text-lg sm:text-xl font-black font-mono block truncate ${analyticsCalculations.edgeMargin >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.edgeMargin >= 0 ? '+' : ''}{analyticsCalculations.edgeMargin.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Win% − BreakEven%</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Favorable Gain (MFE)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#00ff87] block truncate">
                            +{currency.symbol}{analyticsCalculations.mfe.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Peak profit above base</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Adverse Dip (MAE)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                            -{currency.symbol}{analyticsCalculations.mae.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Deepest dip below base</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Trough Bankroll Cushion</span>
                          <span className={`text-lg sm:text-xl font-bold font-mono block truncate ${analyticsCalculations.lowestCushion > 25 ? 'text-gray-300' : 'text-[#ff3b30]'}`}>
                            {analyticsCalculations.lowestCushion.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Lowest capital left</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 5: Spin Outcome Distribution */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Activity className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Spin Outcome Distribution ({analyticsCalculations.completedSpins} Spins Total)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Overall Win Rate</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-[#00ff87] block truncate">{analyticsCalculations.winRate.toFixed(1)}%</span>
                          <span className="text-xs text-gray-400 font-mono mt-0.5 block">{analyticsCalculations.totalWins} wins</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Overall Loss Rate</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-[#ff3b30] block truncate">{analyticsCalculations.lossRate.toFixed(1)}%</span>
                          <span className="text-xs text-gray-400 font-mono mt-0.5 block">{analyticsCalculations.totalLosses} losses</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Wins (Target Hit)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-emerald-300 block truncate">{analyticsCalculations.maxWins}</span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                            {analyticsCalculations.totalWins > 0 ? ((analyticsCalculations.maxWins / analyticsCalculations.totalWins) * 100).toFixed(0) : 0}% of wins
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Partial Wins</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-blue-400 block truncate">{analyticsCalculations.partialWins}</span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">partial payouts</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Partial Losses</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-orange-400 block truncate">{analyticsCalculations.partialLosses}</span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">downturn cushions</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Push / Breakeven</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-400 block truncate">{analyticsCalculations.pushes}</span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">zero P&amp;L spins</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 6: Volatility & Underwater Recovery */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Gauge className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Volatility, Underwater Duration &amp; Survival
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Underwater Period</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-amber-300 block truncate">
                            {analyticsCalculations.maxUnderwater} <span className="text-xs font-normal text-gray-400">spins</span>
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Longest time between peaks</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Capital Survival Buffer</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {analyticsCalculations.survivalSpinsAtAvgLoss} <span className="text-xs font-normal text-gray-400">spins</span>
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Spins remaining at avg loss</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Return Volatility (Std Dev)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-200 block truncate">
                            {currency.symbol}{analyticsCalculations.stdevReturns.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Per spin return deviation</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Downside Risk (Semi-Dev)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-red-400 block truncate">
                            {currency.symbol}{analyticsCalculations.downsideDeviation.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Negative outcome volatility</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Sortino Ratio</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {analyticsCalculations.sortinoRatio.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Downside-adjusted edge</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 7: Progression Escalation & Turnover */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Flame className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Progression Escalation &amp; Wager Footprint
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Total Wagered (Turnover)</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {currency.symbol}{analyticsCalculations.totalWagered.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">cumulative handle</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Turnover Velocity</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-300 block truncate">
                            {analyticsCalculations.turnoverVelocity.toFixed(1)}×
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">bankroll turned over</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Average Wager</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-200 block truncate">
                            {currency.symbol}{analyticsCalculations.avgBetSize.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">per spin average</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Wager Reached</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-amber-300 block truncate">
                            {currency.symbol}{analyticsCalculations.maxBetSize.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">highest bet spike</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Escalation Frequency</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-amber-300 block truncate">
                            {analyticsCalculations.escalationRate.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">{analyticsCalculations.escalatedSpins} escalated spins</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Max Multiplier Hit</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 block truncate">
                            {analyticsCalculations.maxMultiplier.toFixed(1)}×
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Avg: {analyticsCalculations.avgMultiplier.toFixed(2)}×</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/[0.08]" />

                    {/* Group 8: Risk-Adjusted Health & House Edge */}
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <ShieldCheck className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Risk-Adjusted Performance &amp; House Edge Comparison
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-8 gap-y-5">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Sharpe Ratio</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {analyticsCalculations.sharpeRatio.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">excess return / total risk</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Calmar Ratio</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-white block truncate">
                            {analyticsCalculations.calmarRatio.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Net Profit / Max Drawdown</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Recovery Factor</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-200 block truncate">
                            {analyticsCalculations.recoveryFactor.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">rebound efficiency</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Realized House Edge</span>
                          <span className={`text-lg sm:text-xl font-bold font-mono block truncate ${analyticsCalculations.realizedHouseEdge <= 0 ? 'text-[#00ff87]' : 'text-gray-300'}`}>
                            {analyticsCalculations.realizedHouseEdge.toFixed(2)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Actual table take</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400 font-medium block">Theoretical House Edge</span>
                          <span className="text-lg sm:text-xl font-bold font-mono text-gray-400 block truncate">
                            {analyticsCalculations.theoreticalHouseEdge.toFixed(2)}%
                          </span>
                          <span className="text-xs text-gray-500 font-mono mt-0.5 block">Rulebook standard</span>
                        </div>
                      </div>
                    </div>

                    {/* Group 9: Multi-Session Portfolio Summary / Session Benchmark */}
                    {results.totalSessions > 1 && (
                      <>
                        <div className="border-b border-white/[0.08]" />
                        {selectedSessionScope === 'overall' ? (
                          <div>
                            <div className="flex items-center gap-2 mb-3.5">
                              <Layers className="w-4 h-4 text-[#00ff87]" />
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                                Multi-Session Portfolio Summary ({results.totalSessions} Sessions)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Session Win Rate</span>
                                <span className="text-lg sm:text-xl font-black font-mono text-[#00ff87] block truncate">{results.sessionWinRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400 font-mono mt-0.5 block">{results.sessionsWon}W · {results.sessionsLost}L · {results.sessionsBreakeven}E</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Avg Net / Session</span>
                                <span className={`text-lg sm:text-xl font-bold font-mono block truncate ${results.avgProfitPerSession >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                  {results.avgProfitPerSession >= 0 ? '+' : ''}{currency.symbol}{results.avgProfitPerSession.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">expected session P&amp;L</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Median Net / Session</span>
                                <span className="text-lg sm:text-xl font-bold font-mono text-gray-300 block truncate">
                                  {currency.symbol}{results.medianProfitPerSession.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">50th percentile</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Best Session Net</span>
                                <span className="text-lg sm:text-xl font-bold font-mono text-[#00ff87] block truncate">
                                  +{currency.symbol}{results.bestSessionNet.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">top single run</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Worst Session Net</span>
                                <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                                  {results.worstSessionNet < 0 ? '-' : ''}{currency.symbol}{Math.abs(results.worstSessionNet).toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">maximum draw run</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Exit Thresholds</span>
                                <span className="text-xs text-emerald-400 block font-mono font-semibold">TP: {results.targetProfitHits} ({results.targetProfitHitRate}%)</span>
                                <span className="text-xs text-red-400 block font-mono font-semibold">SL: {results.stopLossHits} ({results.stopLossHitRate}%)</span>
                                <span className="text-xs text-gray-400 block font-mono">Busts: {results.bustCount}</span>
                              </div>
                            </div>
                          </div>
                        ) : inspectedSession ? (
                          <div>
                            <div className="flex items-center justify-between mb-3.5">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[#00ff87]" />
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                                  Session #{inspectedSession.sessionIndex} vs. Portfolio Benchmark ({results.totalSessions} Sessions)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedSessionScope('overall')}
                                className="text-xs text-[#00ff87] hover:underline font-bold transition cursor-pointer"
                              >
                                View Overall Portfolio Summary →
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-8 gap-y-5">
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Session Net Profit</span>
                                <span className={`text-lg sm:text-xl font-black font-mono block truncate ${inspectedSession.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                  {inspectedSession.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(inspectedSession.netProfit).toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                  {inspectedSession.netProfit >= results.avgProfitPerSession ? '+' : ''}
                                  {currency.symbol}{(inspectedSession.netProfit - results.avgProfitPerSession).toFixed(2)} vs portfolio avg
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Portfolio P&amp;L Rank</span>
                                <span className="text-lg sm:text-xl font-black font-mono text-white block truncate">
                                  #{results.sessions.slice().sort((a, b) => b.netProfit - a.netProfit).findIndex((s) => s.sessionIndex === inspectedSession.sessionIndex) + 1}
                                  <span className="text-xs font-normal text-gray-400"> of {results.totalSessions}</span>
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                  {inspectedSession.sessionIndex === bestSession?.sessionIndex ? '★ Best performing session' : inspectedSession.sessionIndex === worstSession?.sessionIndex ? 'Worst drawdown session' : 'Session ranking'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Session Duration</span>
                                <span className="text-lg sm:text-xl font-bold font-mono text-gray-200 block truncate">
                                  {inspectedSession.completedSpins} <span className="text-xs font-normal text-gray-400">/ {results.totalSpins}</span>
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                  {((inspectedSession.completedSpins / results.totalSpins) * 100).toFixed(0)}% of target spins
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Exit Status</span>
                                <span className={`text-base sm:text-lg font-bold font-mono block truncate ${inspectedSession.stopReason === 'Target Profit Reached' ? 'text-[#00ff87]' : inspectedSession.stopReason === 'Stop Loss Hit' || inspectedSession.stopReason?.includes('depleted') ? 'text-[#ff3b30]' : 'text-gray-300'}`}>
                                  {inspectedSession.stopReason || 'Max Spins Completed'}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">Session termination</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Session Max Drawdown</span>
                                <span className="text-lg sm:text-xl font-bold font-mono text-[#ff3b30] block truncate">
                                  {currency.symbol}{inspectedSession.maxDrawdown.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                  vs {currency.symbol}{results.maxDrawdown.toLocaleString()} overall max
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-400 font-medium block">Session ROI %</span>
                                <span className={`text-lg sm:text-xl font-black font-mono block truncate ${inspectedSession.roiPercent >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                  {inspectedSession.roiPercent >= 0 ? '+' : ''}{inspectedSession.roiPercent.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5 block">
                                  vs {results.roiPercent >= 0 ? '+' : ''}{results.roiPercent.toFixed(1)}% portfolio
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}

                  </div>
                )}

                {/* ── Tab: Sessions List ── */}
                {activeAnalysisTab === 'sessions' && results.totalSessions > 1 && (
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400 font-medium"><b className="text-white">{results.sessions.length}</b> Sessions Simulated</span>
                      <div className="flex items-center gap-3">
                        {bestSession && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSessionScope(bestSession.sessionIndex);
                              setInspectedSessionIndex(bestSession.sessionIndex);
                              setIsSpinDrawerOpen(true);
                            }}
                            className="text-xs text-[#00ff87] font-semibold hover:underline cursor-pointer"
                          >
                            Best #{bestSession.sessionIndex} (+{currency.symbol}{bestSession.netProfit.toFixed(2)})
                          </button>
                        )}
                        {worstSession && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSessionScope(worstSession.sessionIndex);
                              setInspectedSessionIndex(worstSession.sessionIndex);
                              setIsSpinDrawerOpen(true);
                            }}
                            className="text-xs text-[#ff3b30] font-semibold hover:underline cursor-pointer"
                          >
                            Worst #{worstSession.sessionIndex} ({currency.symbol}{worstSession.netProfit.toFixed(2)})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleExportSessionsCSV}
                          className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Sessions CSV</span>
                        </button>
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left text-sm font-mono">
                        <thead className="sticky top-0 bg-[#070c09] z-10 border-b border-white/[0.08] text-xs text-gray-400 uppercase">
                          <tr>
                            <th className="py-2.5 pr-3">Session</th>
                            <th className="py-2.5 pr-3">Spins</th>
                            <th className="py-2.5 pr-3">Exit Reason</th>
                            <th className="py-2.5 pr-3">Max DD</th>
                            <th className="py-2.5 pr-3">Net P&amp;L</th>
                            <th className="py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {results.sessions.map((s) => {
                            const isSelected = s.sessionIndex === inspectedSessionIndex;
                            return (
                              <tr
                                key={s.sessionIndex}
                                onClick={() => {
                                  setInspectedSessionIndex(s.sessionIndex);
                                  setSelectedSessionScope(s.sessionIndex);
                                }}
                                className={`cursor-pointer transition ${isSelected ? 'bg-[#00ff87]/[0.06]' : 'hover:bg-white/[0.03]'}`}
                              >
                                <td className="py-2.5 pr-3 font-bold text-white">#{s.sessionIndex}</td>
                                <td className="py-2.5 pr-3 text-gray-300">{s.completedSpins} / {results.totalSpins}</td>
                                <td className="py-2.5 pr-3">
                                  <span className={`text-xs ${s.stopReason === 'Target Profit Reached' ? 'text-[#00ff87]' : s.stopReason === 'Stop Loss Hit' || s.stopReason?.includes('depleted') ? 'text-[#ff3b30]' : 'text-gray-400'}`}>
                                    {s.stopReason || 'Max Spins'}
                                  </span>
                                </td>
                                <td className="py-2.5 pr-3 text-[#ff3b30]">{currency.symbol}{s.maxDrawdown.toLocaleString()}</td>
                                <td className={`py-2.5 pr-3 font-bold ${s.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                                  {s.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(s.netProfit).toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSessionScope(s.sessionIndex);
                                        setInspectedSessionIndex(s.sessionIndex);
                                        setActiveAnalysisTab('overview');
                                      }}
                                      className="text-xs text-[#00ff87] font-semibold hover:underline cursor-pointer"
                                    >
                                      View Analytics →
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSessionScope(s.sessionIndex);
                                        setInspectedSessionIndex(s.sessionIndex);
                                        setIsSpinDrawerOpen(true);
                                      }}
                                      className={`text-xs font-semibold transition cursor-pointer ${isSelected ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                      Spins
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Tab: Levels ── */}
                {activeAnalysisTab === 'levels' && (
                  <div className="overflow-y-auto">
                    <table className="w-full text-left text-sm font-mono">
                      <thead className="sticky top-0 bg-[#070c09] z-10 border-b border-white/[0.08] text-xs text-gray-400 uppercase">
                        <tr>
                          <th className="py-2.5 pr-3">Level</th>
                          <th className="py-2.5 pr-3">Wager</th>
                          <th className="py-2.5 pr-3">Spins</th>
                          <th className="py-2.5 pr-3">Max Wins</th>
                          <th className="py-2.5 pr-3">Part Wins</th>
                          <th className="py-2.5 pr-3">Losses</th>
                          <th className="py-2.5 pr-3">Win%</th>
                          <th className="py-2.5 pr-3">Net P&amp;L</th>
                          <th className="py-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {results.levelStats.map((stat) => (
                          <tr key={stat.levelNumber} className="hover:bg-white/[0.03] transition">
                            <td className="py-3 pr-3 font-bold text-white text-base">L{stat.levelNumber}</td>
                            <td className="py-3 pr-3 text-gray-200 text-sm">{currency.symbol}{stat.wager}</td>
                            <td className="py-3 pr-3 text-gray-300 text-sm">{stat.spinsCount} <span className="text-gray-500 text-xs">({stat.spinsPercent}%)</span></td>
                            <td className="py-3 pr-3 text-[#00ff87] font-semibold">{stat.maxWins}</td>
                            <td className="py-3 pr-3 text-blue-400 font-semibold">{stat.partialWins}</td>
                            <td className="py-3 pr-3 text-[#ff3b30] font-semibold">{stat.totalLosses + stat.partialLosses}</td>
                            <td className="py-3 pr-3 text-gray-200 font-bold">{stat.winRate}%</td>
                            <td className={`py-3 pr-3 font-bold text-base ${stat.netProfit >= 0 ? 'text-[#00ff87]' : 'text-[#ff3b30]'}`}>
                              {stat.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(stat.netProfit).toLocaleString()}
                            </td>
                            <td className="py-3 text-right">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stat.status === 'Profit Driver' ? 'bg-emerald-950/60 text-[#00ff87] border border-emerald-500/30' : stat.status === 'Drawdown Driver' ? 'bg-red-950/60 text-[#ff3b30] border border-red-500/30' : 'text-gray-400'}`}>
                                {stat.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Tab: Rule Triggers ── */}
                {activeAnalysisTab === 'rules' && (
                  <div className="overflow-y-auto">
                    {(results.conditionStats || []).length === 0 ? (
                      <p className="text-sm text-gray-400 py-10 text-center">No automation rules were active during this simulation.</p>
                    ) : (
                      <table className="w-full text-left text-sm font-mono">
                        <thead className="sticky top-0 bg-[#070c09] z-10 border-b border-white/[0.08] text-xs text-gray-400 uppercase">
                          <tr>
                            <th className="py-2.5 pr-3">#</th>
                            <th className="py-2.5 pr-3">Trigger Condition</th>
                            <th className="py-2.5 pr-3">Action Taken</th>
                            <th className="py-2.5 pr-3">Times Fired</th>
                            <th className="py-2.5 text-right">Trigger Frequency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {(results.conditionStats || []).map((stat) => (
                            <tr key={stat.conditionId} className="hover:bg-white/[0.03] transition">
                              <td className="py-3 pr-3 font-bold text-gray-300">#{stat.ruleNumber}</td>
                              <td className="py-3 pr-3 text-amber-300 font-semibold">{stat.triggerDesc}</td>
                              <td className="py-3 pr-3 text-[#00ff87] font-semibold">{stat.actionDesc}</td>
                              <td className="py-3 pr-3 text-white font-bold text-base">{stat.triggerCount}×</td>
                              <td className="py-3 text-right text-gray-300 font-bold">{stat.triggerPercent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── Tab: AI Advisor ── */}
                {activeAnalysisTab === 'advisor' && results.aiSuggestions && (
                  <div className="space-y-5 overflow-y-auto">
                    <div className="border-l-2 border-[#00ff87] pl-4 py-2 bg-[#00ff87]/[0.03]">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-[#00ff87]" />
                        <span className="text-sm font-bold text-white">{results.aiSuggestions.title}</span>
                        {results.aiSuggestions.archetype && (
                          <span className="px-2 py-0.5 rounded bg-white/5 text-xs font-mono font-bold text-gray-300 uppercase">
                            {results.aiSuggestions.archetype.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{results.aiSuggestions.diagnosis}</p>
                    </div>

                    {results.aiSuggestions.keyObservations.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest block mb-2">Observed Patterns</span>
                        <div className="space-y-1.5">
                          {results.aiSuggestions.keyObservations.map((obs, oIdx) => (
                            <div key={oIdx} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-[#00ff87] font-bold mt-0.5 text-xs">·</span>
                              <span className="leading-snug">{obs}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Recommended Rules ({results.aiSuggestions.suggestedConditions.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectAllAdvisorRules}
                          className="text-xs font-semibold text-[#00ff87] hover:underline transition cursor-pointer"
                        >
                          {selectedAdvisorRules.length === results.aiSuggestions.suggestedConditions.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div className="space-y-0 divide-y divide-white/[0.05] border-y border-white/[0.08]">
                        {results.aiSuggestions.suggestedConditions.map((cond, cIdx) => {
                          const isChecked = selectedAdvisorRules.includes(cond.id);
                          const reasonText = cond.reason || results.aiSuggestions?.conditionReasons?.[cond.id];
                          return (
                            <div
                              key={cond.id || cIdx}
                              onClick={() => handleToggleAdvisorRule(cond.id)}
                              className={`py-3 cursor-pointer select-none transition ${isChecked ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleAdvisorRule(cond.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded accent-[#00ff87] cursor-pointer shrink-0"
                                />
                                <div className="flex items-center gap-2.5 flex-wrap text-xs">
                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold font-mono text-xs">
                                    {formatTriggerDesc(cond)}
                                  </span>
                                  <span className="text-gray-500">→</span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold font-mono text-xs">
                                    {formatActionDesc(cond)}
                                  </span>
                                </div>
                              </div>
                              {reasonText && (
                                <div className="mt-1.5 pl-7 text-xs text-gray-400 leading-relaxed">
                                  <span className="text-emerald-400 font-medium">Why: </span>{reasonText}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleMergeAISuggestions}
                        disabled={selectedAdvisorRules.length === 0}
                        className="flex items-center gap-1.5 text-xs text-[#00ff87] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:underline transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Merge Selected ({selectedAdvisorRules.length})
                      </button>
                      <span className="text-gray-600">·</span>
                      <button
                        type="button"
                        onClick={handleReplaceAISuggestions}
                        disabled={selectedAdvisorRules.length === 0}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00ff87] hover:bg-[#00e676] text-black rounded-lg text-xs font-extrabold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Replace Existing
                      </button>
                    </div>

                    {results.aiSuggestions.predictedImpact && (
                      <div className="border-l-2 border-emerald-500/40 pl-3 py-1.5 text-xs">
                        <span className="text-gray-400 font-medium">Expected Impact: </span>
                        <span className="text-emerald-300">{results.aiSuggestions.predictedImpact}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : isRunning ? (
              /* Simulation HUD */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-[#00ff87] animate-spin" />
                  <Activity className="w-6 h-6 text-[#00ff87] animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff87] animate-ping" />
                    Monte Carlo Engine Active
                  </div>
                  <div className="text-xs text-gray-400">{simulationStage}</div>
                </div>
                <div className="flex items-center gap-6 text-xs font-mono">
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">Spins</span>
                    <span className="text-lg font-black text-white">{simulatedSpinsCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">Progress</span>
                    <span className="text-lg font-black text-[#00ff87]">{simulationProgress}%</span>
                  </div>
                </div>
                <div className="w-full max-w-xs h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-[#00ff87] rounded-full transition-all duration-200"
                    style={{ width: `${simulationProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              /* Standby State */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-24 space-y-2">
                <Activity className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-base font-semibold text-gray-300">Ready for Simulation</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Select a strategy, enter bankroll and spin counts, configure rules, then click <strong className="text-[#00ff87]">Run Simulation</strong> to populate full analytical dashboards.
                </p>
              </div>
            )}
          </div>

          {/* ════════════ DRAWER STYLE SPIN LOG OVERLAY ════════════ */}
          {isSpinDrawerOpen && results && (
            <div className="absolute inset-0 bg-[#060a08]/98 backdrop-blur-md z-40 flex flex-col border-l border-white/10 shadow-2xl transition-all duration-300">
              
              {/* Drawer Top Header */}
              <div className="px-6 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#080e0a]">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#00ff87]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white tracking-wide">Detailed Spin Log Audit</h2>
                      <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs text-gray-300">
                        {activeHistory.length - 1} spins
                      </span>
                    </div>
                    {results.totalSessions > 1 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Viewing Session #{inspectedSessionIndex} of {results.totalSessions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Drawer Actions */}
                <div className="flex items-center gap-3">
                  {results.totalSessions > 1 && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-xs text-gray-400 font-medium">Session:</span>
                      <select
                        value={inspectedSessionIndex}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          setInspectedSessionIndex(idx);
                          setSelectedSessionScope(idx);
                        }}
                        className="bg-[#0e1611] border border-white/20 rounded px-2.5 py-1 text-xs text-white font-medium outline-none"
                      >
                        {results.sessions.map((s) => (
                          <option key={s.sessionIndex} value={s.sessionIndex} className="bg-[#0a120e]">
                            Session #{s.sessionIndex} ({s.netProfit >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(s.netProfit).toFixed(1)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff87] hover:bg-[#00e676] text-black font-extrabold text-xs rounded transition shadow-sm cursor-pointer"
                    title="Export spins as CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSpinDrawerOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                    title="Close Spin Log (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Subheader / Filter Bar */}
              <div className="px-6 py-2.5 border-b border-white/[0.08] bg-[#070b08] flex items-center justify-between gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: `All (${Math.max(0, activeHistory.length - 1)})` },
                    { key: 'max_win', label: `Max Win (${activeHistory.slice(1).filter((p) => p.outcome === 'max_win').length})` },
                    { key: 'partial_win', label: `Part Win (${activeHistory.slice(1).filter((p) => p.outcome === 'partial_win').length})` },
                    { key: 'partial_loss', label: `Part Loss (${activeHistory.slice(1).filter((p) => p.outcome === 'partial_loss').length})` },
                    { key: 'total_loss', label: `Total Loss (${activeHistory.slice(1).filter((p) => p.outcome === 'total_loss').length})` },
                    { key: 'rules', label: `Rules Fired (${activeHistory.slice(1).filter((p) => p.conditionApplied).length})` },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSpinFilter(key as any)}
                      className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                        spinFilter === key
                          ? 'bg-[#00ff87] text-black font-bold'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
                  <input
                    type="text"
                    value={spinSearch}
                    onChange={(e) => setSpinSearch(e.target.value)}
                    placeholder="Search pocket, rule, action…"
                    className="w-full pl-8 pr-2.5 py-1 bg-black/40 border border-white/15 focus:border-[#00ff87]/60 rounded text-xs text-white placeholder-gray-500 outline-none"
                  />
                </div>
              </div>

              {/* Drawer Table Body — High-readability large format */}
              <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#060a08] z-10 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="py-2.5 pr-3">Spin</th>
                      <th className="py-2.5 pr-3">Pocket</th>
                      <th className="py-2.5 pr-3">Outcome</th>
                      <th className="py-2.5 pr-3">Level &amp; Bet</th>
                      <th className="py-2.5 pr-3">Wager</th>
                      <th className="py-2.5 pr-3">Payout</th>
                      <th className="py-2.5 pr-3">Net Win/Loss</th>
                      <th className="py-2.5 pr-3">Bankroll</th>
                      <th className="py-2.5">Rule Triggered &amp; Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredHistory.map((pt) => (
                      <tr
                        key={pt.spin}
                        className={`hover:bg-white/[0.03] transition text-sm ${pt.conditionApplied ? 'bg-amber-500/[0.03]' : ''}`}
                      >
                        <td className="py-3 pr-3 text-gray-400 font-mono font-bold text-sm">#{pt.spin}</td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-sm ${getPocketBadgeClass(pt.pocket)}`}>
                            {pt.pocket}
                          </span>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {getOutcomeBadge(pt.outcome)}
                        </td>
                        <td className="py-3 pr-3 text-gray-200 font-mono text-sm">
                          L{pt.level} <span className="text-[#00ff87] font-bold">×{pt.multiplier}</span>
                        </td>
                        <td className="py-3 pr-3 text-gray-300 font-mono text-sm">{currency.symbol}{pt.wager.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-gray-200 font-mono text-sm">{currency.symbol}{pt.payout.toFixed(2)}</td>
                        <td className={`py-3 pr-3 font-black font-mono text-sm ${pt.netWin > 0 ? 'text-[#00ff87]' : pt.netWin < 0 ? 'text-[#ff3b30]' : 'text-gray-400'}`}>
                          {pt.netWin > 0 ? `+${currency.symbol}${pt.netWin.toFixed(2)}` : pt.netWin < 0 ? `-${currency.symbol}${Math.abs(pt.netWin).toFixed(2)}` : '0.00'}
                        </td>
                        <td className="py-3 pr-3 text-white font-mono text-sm font-bold">{currency.symbol}{pt.balance.toFixed(2)}</td>
                        <td className="py-3">
                          {pt.conditionApplied ? (
                            <span className="text-xs text-amber-300 font-medium leading-relaxed block max-w-sm truncate" title={`${pt.conditionApplied} → ${pt.actionTaken}`}>
                              {pt.conditionApplied} <span className="text-gray-500">➔</span> <span className="text-[#00ff87] font-bold">{pt.actionTaken}</span>
                            </span>
                          ) : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHistory.length === 0 && (
                  <div className="text-center py-16 text-gray-500 text-sm">
                    No spins match the selected filter.
                  </div>
                )}
              </div>

              {/* Drawer Bottom Bar */}
              <div className="px-6 py-2.5 border-t border-white/10 bg-[#080d0a] flex items-center justify-between text-xs text-gray-500 shrink-0">
                <span>Displaying {filteredHistory.length} of {activeHistory.length - 1} recorded spins</span>
                <button
                  type="button"
                  onClick={() => setIsSpinDrawerOpen(false)}
                  className="text-xs text-gray-400 hover:text-white font-semibold transition cursor-pointer"
                >
                  Close Drawer (Esc)
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ════════════ DEDICATED MODALS (NOT AUTO-EXPANDED ON PAGE) ════════════ */}
      <NaturalLanguageArchitectModal
        isOpen={isNLModalOpen}
        onClose={() => setIsNLModalOpen(false)}
        rules={rules}
        onApplyStrategy={handleApplyNLStrategy}
      />

      <AIConditionAdvisorModal
        isOpen={isAIAdvisorModalOpen}
        onClose={() => setIsAIAdvisorModalOpen(false)}
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
  );
};
