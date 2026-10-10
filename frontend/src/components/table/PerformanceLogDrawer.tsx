import React, { useState, useEffect, useRef } from 'react';
import { useSimulatorStore, type SpinResult } from '../../stores/simulator.store';
import {
  X,
  TrendingUp,
  BarChart2,
  RotateCcw,
  GripHorizontal,
  Maximize2,
  ExternalLink,
  PanelLeftClose,
  History,
} from 'lucide-react';
import { getPocketColor } from './RacetrackFelt';
import { BetInspectionModal } from './BetInspectionModal';

interface PerformanceLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function getBaseStrategyName(name?: string): string {
  if (!name || name === 'Manual Bet' || name.toLowerCase() === 'freestyle') return 'Freestyle';
  return name.replace(/\s*\((?:L|Level\s*)\d+\)$/i, '').trim() || name;
}

export const PerformanceLogDrawer: React.FC<PerformanceLogDrawerProps> = ({ isOpen, onClose }) => {
  const {
    initialBankroll,
    lastSpinResult,
    spinHistory,
    currency,
    winsCount,
    lossesCount,
    pushesCount,
    totalWagered,
    sessionProfit,
    sessionProfitHistory,
    resetSessionStats,
    strategies,
    currentStrategyId,
    currentStrategyName,
  } = useSimulatorStore();

  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'log'>('stats');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    val: number;
    spinIndex: number;
    strategyName?: string;
  } | null>(null);

  // Bet Inspection Modal state
  const [inspectedSpin, setInspectedSpin] = useState<SpinResult | null>(null);
  const [inspectedBetLabel, setInspectedBetLabel] = useState<string>('');

  // My Bets Floating & Draggable State
  const [isBetsPoppedOut, setIsBetsPoppedOut] = useState(false);
  const [betsPos, setBetsPos] = useState({ x: 430, y: 120 });
  const [isDraggingBets, setIsDraggingBets] = useState(false);
  const betsDragRef = useRef<{ relX: number; relY: number }>({ relX: 0, relY: 0 });

  const handleBetsMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDraggingBets(true);
    betsDragRef.current = {
      relX: e.clientX - betsPos.x,
      relY: e.clientY - betsPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingBets) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(10, Math.min(window.innerWidth - 120, e.clientX - betsDragRef.current.relX));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - betsDragRef.current.relY));
      setBetsPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsDraggingBets(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingBets]);

  // Close on Escape key press: closes inspected modal first, then floating/docked drawer
  useEffect(() => {
    if (!isOpen && !isPoppedOut && !isBetsPoppedOut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (inspectedSpin) {
          setInspectedSpin(null);
        } else if (isBetsPoppedOut && isPoppedOut) {
          setIsBetsPoppedOut(false);
        } else if (isBetsPoppedOut) {
          setIsBetsPoppedOut(false);
          onClose();
        } else if (isPoppedOut) {
          setIsPoppedOut(false);
          onClose();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inspectedSpin, isBetsPoppedOut, isPoppedOut, onClose]);

  // Window Floating & Draggable State
  const [pos, setPos] = useState({ x: 30, y: 75 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ relX: number; relY: number }>({ relX: 0, relY: 0 });

  // Chart Dimensions: Maintain exact same height and aspect ratio when docked in
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartHeight, setChartHeight] = useState<number>(260);

  useEffect(() => {
    if (!isPoppedOut || !chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height >= 140) {
          setChartHeight(Math.round(entry.contentRect.height));
        }
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [isPoppedOut]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore drag if clicking inside buttons or select elements
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) {
      return;
    }
    setIsDragging(true);
    dragRef.current = {
      relX: e.clientX - pos.x,
      relY: e.clientY - pos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(10, Math.min(window.innerWidth - 120, e.clientX - dragRef.current.relX));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragRef.current.relY));
      setPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const lastWin = lastSpinResult ? lastSpinResult.totalPayout : 0;
  const lastBet = lastSpinResult ? lastSpinResult.totalBet : 0;
  const netWin = lastSpinResult ? lastSpinResult.netWin : 0;
  const peak = Math.max(initialBankroll, ...spinHistory.map(s => s.resultingBankroll));
  const low = Math.min(initialBankroll, ...spinHistory.map(s => s.resultingBankroll));

  // Determine active default strategy: if user selected a strategy in store, use it; otherwise 'Freestyle'
  const activeDefaultStrategy = currentStrategyId && currentStrategyName
    ? getBaseStrategyName(currentStrategyName)
    : 'Freestyle';

  // Extract all unique base strategies recorded in session or defined in strategies
  const historyStrategies = sessionProfitHistory
    .filter(p => p.spinIndex > 0 && p.strategyName && p.strategyName !== 'Initial')
    .map(p => getBaseStrategyName(p.strategyName));

  const definedStrategies = (strategies || []).map(s => s.name.trim()).filter(Boolean);

  // Always ensure 'Freestyle' is in the options
  const usedStrategies = Array.from(new Set(['Freestyle', ...historyStrategies, ...definedStrategies]));

  // Active strategy filter (defaults to activeDefaultStrategy, i.e. 'Freestyle' if no strategy is selected)
  const currentStratFilter = selectedStrategy !== null
    ? (selectedStrategy === 'All' || usedStrategies.includes(selectedStrategy) ? selectedStrategy : activeDefaultStrategy)
    : activeDefaultStrategy;

  // Filter metrics and data points by selected strategy
  let displayedPoints: Array<{ spinIndex: number; cumulativeProfit: number; strategyName?: string }>;
  let dispProfit: number;
  let dispWagered: number;
  let dispWins: number;
  let dispLosses: number;
  let dispPushes: number;
  let dispSpins: number;

  if (currentStratFilter === 'All') {
    displayedPoints = sessionProfitHistory.map(p => ({
      spinIndex: p.spinIndex,
      cumulativeProfit: p.cumulativeProfit,
      strategyName: getBaseStrategyName(p.strategyName),
    }));
    dispProfit = sessionProfit;
    dispWagered = totalWagered;
    dispWins = winsCount;
    dispLosses = lossesCount;
    dispPushes = pushesCount;
    dispSpins = sessionProfitHistory.filter(p => p.spinIndex > 0).length;
  } else {
    const stratSpins = sessionProfitHistory.filter(
      p => getBaseStrategyName(p.strategyName) === currentStratFilter && p.spinIndex > 0
    );
    let cum = 0;
    let w = 0;
    let l = 0;
    let pu = 0;
    let wag = 0;
    const pts: Array<{ spinIndex: number; cumulativeProfit: number; strategyName?: string }> = [
      { spinIndex: 0, cumulativeProfit: 0, strategyName: currentStratFilter }
    ];
    stratSpins.forEach((p, idx) => {
      cum += p.netWin;
      wag += p.totalBet;
      if (p.isWin) w++;
      if (p.isLoss) l++;
      if (p.isPush) pu++;
      pts.push({ spinIndex: idx + 1, cumulativeProfit: cum, strategyName: getBaseStrategyName(p.strategyName) });
    });
    displayedPoints = pts;
    dispProfit = cum;
    dispWagered = wag;
    dispWins = w;
    dispLosses = l;
    dispPushes = pu;
    dispSpins = stratSpins.length;
  }

  // Build SVG bezier spline for Live Stats chart
  const W = 320;
  const H = 190;
  const padX = 16;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const ptsData = displayedPoints.length > 0
    ? displayedPoints
    : [{ spinIndex: 0, cumulativeProfit: 0, strategyName: undefined as string | undefined }];
  const allProfits = ptsData.map(p => p.cumulativeProfit);
  let maxP = Math.max(0, ...allProfits);
  let minP = Math.min(0, ...allProfits);

  if (maxP === 0 && minP === 0) {
    maxP = 20;
    minP = -20;
  } else {
    const span = Math.max(maxP - minP, 10);
    maxP += span * 0.12;
    minP -= span * 0.12;
  }

  const range = maxP - minP || 1;
  const getY = (val: number) => padY + innerH * (1 - (val - minP) / range);
  const baselineY = getY(0);

  const coords = ptsData.map((pt, idx) => {
    const x = ptsData.length > 1
      ? padX + (idx / (ptsData.length - 1)) * innerW
      : padX + innerW / 2;
    const y = getY(pt.cumulativeProfit);
    return { x, y };
  });

  const getSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = getSmoothPath(coords);
  const firstX = coords[0]?.x ?? padX;
  const lastX = coords[coords.length - 1]?.x ?? W - padX;
  const closedAreaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  // Filtered bets list for "My Bets" section
  const displayedBets = currentStratFilter === 'All'
    ? spinHistory
    : spinHistory.filter(s => getBaseStrategyName(s.strategyName) === currentStratFilter);

  const renderMyBetsContent = (isStandaloneWindow = false) => (
    <div className={`bg-[#0b121a] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-lg ${isStandaloneWindow ? 'flex-1 min-h-0' : 'shrink-0'}`}>
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-[#121c27] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <History className="w-3.5 h-3.5 text-sky-400" />
          <h4 className="text-xs font-black uppercase tracking-wider text-white">
            My Bets
          </h4>
          <span className="px-1.5 py-0.5 bg-white/10 text-gray-300 rounded text-[10px] font-mono font-bold">
            {displayedBets.length}
          </span>
        </div>

        {!isStandaloneWindow && (
          <button
            onClick={() => setIsBetsPoppedOut(true)}
            title="Pop out My Bets into floating window"
            className="px-2 py-0.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition cursor-pointer"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            <span>Pop Out</span>
          </button>
        )}
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-4 px-3 py-1.5 bg-[#0e1622] border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-gray-400">
        <div className="text-left">Bet ID</div>
        <div className="text-right">Bet Amount</div>
        <div className="text-center">Outcome</div>
        <div className="text-right">Profit</div>
      </div>

      {/* Rows */}
      <div className={`${isStandaloneWindow ? 'flex-1 overflow-y-auto' : 'max-h-56 overflow-y-auto'} divide-y divide-white/5 text-xs font-mono`}>
        {displayedBets.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-[11px] italic font-mono">
            No bets placed yet. Place bets on the felt and spin!
          </div>
        ) : (
          displayedBets.map((s, idx) => {
            const betNum = displayedBets.length - idx;
            const p = s.pocketNumber;
            const color = getPocketColor(p);
            const isWin = s.netWin > 0;
            const isLoss = s.netWin < 0;

            return (
              <div
                key={s.id || idx}
                onClick={() => {
                  setInspectedSpin(s);
                  setInspectedBetLabel(`Bet #${betNum}`);
                }}
                title="Click to view felt & outcome details"
                className="grid grid-cols-4 px-3 py-2 items-center hover:bg-white/10 transition cursor-pointer group"
              >
                {/* 1. Bet ID */}
                <div className="text-left font-bold text-gray-300 group-hover:text-white flex items-center space-x-1">
                  <span className="text-sky-400">#{betNum}</span>
                </div>

                {/* 2. Bet Amount */}
                <div className="text-right font-black text-gray-200">
                  {currency.symbol}{s.totalBet.toLocaleString()}
                </div>

                {/* 3. Number Outcome Badge */}
                <div className="flex justify-center">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] text-white shadow ${
                      color === 'red'
                        ? 'bg-[#c8191d]'
                        : color === 'black'
                        ? 'bg-[#15191e] border border-white/30'
                        : 'bg-[#008f39]'
                    }`}
                  >
                    {p}
                  </span>
                </div>

                {/* 4. Profit */}
                <div
                  className={`text-right font-black ${
                    isWin ? 'text-[#00e676]' : isLoss ? 'text-[#ff3b30]' : 'text-gray-400'
                  }`}
                >
                  {isWin
                    ? `+${currency.symbol}${s.netWin.toLocaleString()}`
                    : isLoss
                    ? `-${currency.symbol}${Math.abs(s.netWin).toLocaleString()}`
                    : `${currency.symbol}0`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderDrawerBody = () => (
    <>
      {/* Tab switchers: Live Stats vs Performance Log */}
      <div className="flex space-x-2 px-4 pt-3 pb-2 text-xs font-black shrink-0">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-sky-500/30 text-sky-300 shadow border border-sky-400/40'
              : 'text-gray-400 hover:text-white bg-black/20'
          }`}
        >
          Live Chart & Metrics
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'log'
              ? 'bg-sky-500/30 text-sky-300 shadow border border-sky-400/40'
              : 'text-gray-400 hover:text-white bg-black/20'
          }`}
        >
          Session Summary
        </button>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3">
        {activeTab === 'stats' ? (
          <>
            {/* Strategy Filter Dropdown (replaces Bets & All) */}
            <div className="flex items-center justify-between bg-[#152230] border border-white/15 rounded-xl px-3 py-2 shadow-inner shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black text-sky-400 uppercase tracking-wider">Strategy:</span>
                <select
                  value={currentStratFilter}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer pr-2"
                >
                  <option value="All" className="bg-[#101923] text-white">
                    All Strategies ({sessionProfitHistory.filter(p => p.spinIndex > 0).length} spins)
                  </option>
                  {usedStrategies.map(strat => {
                    const count = sessionProfitHistory.filter(
                      p => getBaseStrategyName(p.strategyName) === strat && p.spinIndex > 0
                    ).length;
                    return (
                      <option key={strat} value={strat} className="bg-[#101923] text-white">
                        {strat} ({count} spins)
                      </option>
                    );
                  })}
                </select>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                {dispSpins} spins
              </span>
            </div>

            {/* Profit & Metrics Card */}
            <div className="p-3.5 bg-[#121c27] border border-white/10 rounded-2xl shadow-xl flex items-center justify-between shrink-0">
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Profit</span>
                  <span className={`text-xl font-black font-mono ${dispProfit >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
                    {dispProfit >= 0 ? `+${currency.symbol}${dispProfit.toLocaleString()}` : `-${currency.symbol}${Math.abs(dispProfit).toLocaleString()}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Wagered</span>
                  <span className="text-sm font-black font-mono text-gray-200">
                    {currency.symbol}{dispWagered.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="h-14 w-[1px] bg-white/15" />

              <div className="space-y-1 text-right text-xs">
                <div>
                  <span className="text-gray-400 font-bold mr-1.5">Wins:</span>
                  <span className="font-black font-mono text-[#00e676]">{dispWins}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold mr-1.5">Losses:</span>
                  <span className="font-black font-mono text-[#ff3b30]">{dispLosses}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold mr-1.5">Pushes:</span>
                  <span className="font-black font-mono text-gray-300">{dispPushes}</span>
                </div>
              </div>
            </div>

            {/* Resizable / Responsive Live Stats Spline Area Chart */}
            <div
              ref={chartContainerRef}
              style={{
                height: isPoppedOut ? undefined : `${chartHeight}px`,
              }}
              className={`w-full flex flex-col bg-[#070e16] border border-white/15 rounded-2xl p-3 shadow-inner relative overflow-hidden ${
                isPoppedOut ? 'flex-1 min-h-[160px]' : 'shrink-0'
              }`}
            >
              {/* Header displaying amount: on hover shows amount relative to cursor on curve, otherwise overall profit/loss */}
              {(() => {
                const currentVal = hoveredPoint ? hoveredPoint.val : dispProfit;
                const currentLabel = hoveredPoint
                  ? (hoveredPoint.spinIndex === 0 ? 'Start' : `Spin #${hoveredPoint.spinIndex}`)
                  : (currentStratFilter === 'All' ? `${dispSpins} spins` : currentStratFilter);

                return (
                  <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
                    <span className="flex items-center space-x-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span
                        className={`font-black font-mono text-sm tracking-wider ${
                          currentVal >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'
                        }`}
                      >
                        {currentVal >= 0
                          ? `+${currency.symbol}${currentVal.toLocaleString()}`
                          : `-${currency.symbol}${Math.abs(currentVal).toLocaleString()}`}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {currentLabel}
                    </span>
                  </div>
                );
              })()}

              <div
                className="flex-1 w-full h-full flex items-center justify-center relative cursor-crosshair group"
                onMouseMove={(e) => {
                  if (ptsData.length === 0 || coords.length === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                  const svgX = (mouseX / rect.width) * W;

                  let closestIdx = 0;
                  let minDiff = Infinity;
                  for (let i = 0; i < coords.length; i++) {
                    const diff = Math.abs(coords[i].x - svgX);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestIdx = i;
                    }
                  }

                  const p = coords[closestIdx];
                  const pt = ptsData[closestIdx];
                  if (p && pt) {
                    setHoveredPoint({
                      x: p.x,
                      y: p.y,
                      val: pt.cumulativeProfit,
                      spinIndex: pt.spinIndex,
                      strategyName: pt.strategyName,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  className="w-full h-full"
                >
                  <defs>
                    <linearGradient id="popProfitGreenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                    </linearGradient>

                    <linearGradient id="popProfitRedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6" />
                    </linearGradient>

                    <clipPath id="popClipAboveZero">
                      <rect x="0" y="0" width={W} height={baselineY} />
                    </clipPath>

                    <clipPath id="popClipBelowZero">
                      <rect x="0" y={baselineY} width={W} height={H - baselineY} />
                    </clipPath>
                  </defs>

                  {/* Baseline (0 profit line) */}
                  <line
                    x1={padX}
                    y1={baselineY}
                    x2={W - padX}
                    y2={baselineY}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />

                  {/* Portions above 0 (Green) */}
                  <g clipPath="url(#popClipAboveZero)">
                    <path d={closedAreaPath} fill="url(#popProfitGreenGrad)" />
                    <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                  </g>

                  {/* Portions below 0 (Red) */}
                  <g clipPath="url(#popClipBelowZero)">
                    <path d={closedAreaPath} fill="url(#popProfitRedGrad)" />
                    <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                  </g>

                  {/* Latest outcome pulse dot */}
                  {coords.length > 0 && (
                    <circle
                      cx={coords[coords.length - 1].x}
                      cy={coords[coords.length - 1].y}
                      r="4.5"
                      fill={dispProfit >= 0 ? '#22c55e' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="animate-pulse"
                    />
                  )}

                  {/* Interactive hover crosshair and point marker */}
                  {hoveredPoint && (
                    <g className="pointer-events-none">
                      <line
                        x1={hoveredPoint.x}
                        y1={padY}
                        x2={hoveredPoint.x}
                        y2={H - padY}
                        stroke="rgba(255, 255, 255, 0.5)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <circle
                        cx={hoveredPoint.x}
                        cy={hoveredPoint.y}
                        r="6.5"
                        fill={hoveredPoint.val >= 0 ? '#22c55e' : '#ef4444'}
                        fillOpacity="0.3"
                      />
                      <circle
                        cx={hoveredPoint.x}
                        cy={hoveredPoint.y}
                        r="4"
                        fill="#ffffff"
                        stroke={hoveredPoint.val >= 0 ? '#22c55e' : '#ef4444'}
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>

                {dispSpins === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-[11px] font-mono italic">
                    Place bets and spin to plot live trend
                  </div>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* MY BETS HISTORY SECTION (Below Live Chart)                        */}
            {/* ================================================================= */}
            {isBetsPoppedOut ? (
              <div className="p-3 bg-[#0d1622] border border-dashed border-sky-500/30 rounded-2xl flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center space-x-2 text-sky-300">
                  <History className="w-4 h-4" />
                  <span className="font-bold">My Bets is popped out</span>
                </div>
                <button
                  onClick={() => setIsBetsPoppedOut(false)}
                  className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Dock Back In
                </button>
              </div>
            ) : (
              renderMyBetsContent(false)
            )}
          </>
        ) : (
          /* Session Summary View */
          <div className="space-y-2.5 flex-1 text-xs font-mono">
            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">LAST WIN</span>
              <span className="text-white font-black text-sm">{currency.symbol}{lastWin.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">LAST BET</span>
              <span className="text-white font-black text-sm">{currency.symbol}{lastBet.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">NET WIN</span>
              <span className={`font-black text-sm ${netWin >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
                {netWin >= 0 ? `+${currency.symbol}${netWin.toLocaleString()}` : `-${currency.symbol}${Math.abs(netWin).toLocaleString()}`}
              </span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">TOTAL PROFIT/LOSS</span>
              <span className={`font-black text-sm ${sessionProfit >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
                {sessionProfit >= 0 ? `+${currency.symbol}${sessionProfit.toLocaleString()}` : `-${currency.symbol}${Math.abs(sessionProfit).toLocaleString()}`}
              </span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">PEAK BANKROLL</span>
              <span className="text-[#00e676] font-black text-sm">{currency.symbol}{peak.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">LOW (DRAWDOWN)</span>
              <span className="text-[#ff3b30] font-black text-sm">{currency.symbol}{low.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-[#131c26] border border-white/10 rounded-xl flex justify-between items-center">
              <span className="text-gray-400 font-bold">TOTAL SPINS</span>
              <span className="text-white font-black text-sm">{spinHistory.length}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Determine display modes
  const showDockedDrawer = isOpen && !isPoppedOut && !isBetsPoppedOut;
  const showFloatingChart = isOpen && isPoppedOut;
  const showFloatingBets = isOpen && isBetsPoppedOut;

  if (!isOpen && !isPoppedOut && !isBetsPoppedOut) return null;

  return (
    <>
      {/* 1. Docked Left Side Drawer Panel (Closes automatically when Chart or My Bets is popped out) */}
      {showDockedDrawer && (
        <div className="fixed inset-0 z-50 flex select-none animate-fade-in">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />

          {/* Docked Left Side Drawer Panel */}
          <div className="relative w-96 sm:w-[420px] max-w-full h-full bg-[#080f17] border-r border-white/20 shadow-2xl flex flex-col text-white z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#121c27] shrink-0">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-sky-400" />
                <h3 className="font-black text-xs tracking-wider uppercase text-white">
                  Live Stats & Analytics
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={resetSessionStats}
                  title="Reset Live Stats"
                  className="p-1.5 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsPoppedOut(true)}
                  title="Pop out into floating window"
                  className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Pop Out</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {renderDrawerBody()}
          </div>
        </div>
      )}

      {/* 2. Floating Live Stats / Chart Window */}
      {showFloatingChart && (
        <div
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            minWidth: '380px',
            minHeight: '520px',
            maxWidth: '92vw',
            maxHeight: '90vh',
            resize: 'both',
            overflow: 'hidden',
          }}
          className="fixed z-50 w-[420px] h-[640px] bg-[#0c141d]/95 backdrop-blur-md border-2 border-white/20 rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.85)] flex flex-col select-none text-white animate-fade-in"
        >
          {/* Draggable Header */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#14202d] cursor-move rounded-t-2xl shrink-0"
            title="Drag window anywhere on screen"
          >
            <div className="flex items-center space-x-2">
              <GripHorizontal className="w-4 h-4 text-gray-400" />
              <BarChart2 className="w-4 h-4 text-sky-400" />
              <h3 className="font-black text-sm tracking-wider uppercase text-white">
                Live Stats
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={resetSessionStats}
                title="Reset Live Stats"
                className="p-1.5 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsPoppedOut(false)}
                title="Dock back into side drawer"
                className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition cursor-pointer"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>Dock In</span>
              </button>
              <button
                onClick={() => {
                  setIsPoppedOut(false);
                  setIsBetsPoppedOut(false);
                  onClose();
                }}
                className="p-1.5 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {renderDrawerBody()}

          {/* Resize corner grip */}
          <div className="absolute bottom-1 right-1 pointer-events-none text-white/30">
            <Maximize2 className="w-3.5 h-3.5 rotate-90" />
          </div>
        </div>
      )}

      {/* 3. Floating My Bets Window (when detached independently) */}
      {showFloatingBets && (
        <div
          style={{
            left: `${betsPos.x}px`,
            top: `${betsPos.y}px`,
            minWidth: '360px',
            minHeight: '260px',
            maxWidth: '92vw',
            maxHeight: '80vh',
            resize: 'both',
            overflow: 'hidden',
          }}
          className="fixed z-50 w-[400px] h-[380px] bg-[#0c141d]/95 backdrop-blur-md border-2 border-white/20 rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.85)] flex flex-col select-none text-white animate-fade-in"
        >
          <div
            onMouseDown={handleBetsMouseDown}
            className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#14202d] cursor-move rounded-t-2xl shrink-0"
            title="Drag window anywhere on screen"
          >
            <div className="flex items-center space-x-2">
              <GripHorizontal className="w-4 h-4 text-gray-400" />
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="font-black text-xs tracking-wider uppercase text-white">
                My Bets
              </h3>
              <span className="px-1.5 py-0.5 bg-white/10 text-gray-300 rounded text-[10px] font-mono font-bold">
                {displayedBets.length}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setIsBetsPoppedOut(false)}
                title="Dock back in"
                className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition cursor-pointer"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>Dock In</span>
              </button>
              <button
                onClick={() => {
                  setIsBetsPoppedOut(false);
                  if (!isPoppedOut) {
                    onClose();
                  }
                }}
                className="p-1 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 p-3">
            {renderMyBetsContent(true)}
          </div>
        </div>
      )}

      {/* Bet Inspection Modal */}
      <BetInspectionModal
        isOpen={!!inspectedSpin}
        spin={inspectedSpin}
        betIdLabel={inspectedBetLabel}
        onClose={() => setInspectedSpin(null)}
      />
    </>
  );
};
