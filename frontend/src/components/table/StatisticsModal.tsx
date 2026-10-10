import React, { useState, useMemo, useEffect } from 'react';
import { useSimulatorStore, type PocketValue, type SpinResult } from '../../stores/simulator.store';
import { EUR_WHEEL_SEQUENCE, FRENCH_BETS, getPocketColor } from './RacetrackFelt';
import { X, Flame, Snowflake } from 'lucide-react';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RED_NUMBERS_SET = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export const StatisticsModal: React.FC<StatisticsModalProps> = ({ isOpen, onClose }) => {
  const { historicalSpins, spinHistory } = useSimulatorStore();

  // Active Tab: 'HOT/COLD' | 'ADVANCED' | 'LAST_N'
  const [activeTab, setActiveTab] = useState<'HOT/COLD' | 'ADVANCED' | 'LAST_N'>('HOT/COLD');

  // Slider state: number of historical rounds (10 to 500 in increments of 10)
  const [roundsCount, setRoundsCount] = useState<number>(140);

  // Global hover highlighting state across all instances of the number
  const [hoveredNumber, setHoveredNumber] = useState<PocketValue | null>(null);

  // Combine database historical spins with session spin history (most recent first)
  const allAvailableSpins = useMemo(() => {
    // If historicalSpins loaded from DB, use them; fallback to session spinHistory
    const source = historicalSpins.length > 0 ? historicalSpins : spinHistory;
    return source;
  }, [historicalSpins, spinHistory]);

  // Sliced dataset for the selected N rounds
  const currentDataset = useMemo<SpinResult[]>(() => {
    if (allAvailableSpins.length === 0) return [];
    return allAvailableSpins.slice(0, roundsCount);
  }, [allAvailableSpins, roundsCount]);

  // Actual count of available rounds in this slice
  const actualN = currentDataset.length || 1;

  // Recent history ribbon: top ~12 most recent outcomes
  const recentRibbon = useMemo(() => {
    return allAvailableSpins.slice(0, 12);
  }, [allAvailableSpins]);

  // Pocket frequency map across the current N rounds
  const frequencyMap = useMemo(() => {
    const map: Record<string, number> = {};
    EUR_WHEEL_SEQUENCE.forEach(p => {
      map[String(p)] = 0;
    });
    currentDataset.forEach(s => {
      const key = String(s.pocketNumber);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [currentDataset]);

  // Sorted pockets descending by hit frequency
  const sortedPockets = useMemo(() => {
    return [...EUR_WHEEL_SEQUENCE].sort((a, b) => {
      const freqA = frequencyMap[String(a)] || 0;
      const freqB = frequencyMap[String(b)] || 0;
      return freqB - freqA;
    });
  }, [frequencyMap]);

  // Top 5 Hot and Top 5 Cold pockets
  const hotNumbers = useMemo(() => sortedPockets.slice(0, 5), [sortedPockets]);
  const coldNumbers = useMemo(() => [...sortedPockets].reverse().slice(0, 5), [sortedPockets]);

  const hotSet = useMemo(() => new Set(hotNumbers.map(String)), [hotNumbers]);
  const coldSet = useMemo(() => new Set(coldNumbers.map(String)), [coldNumbers]);

  const maxHits = useMemo(() => {
    const vals = Object.values(frequencyMap);
    return Math.max(1, ...vals);
  }, [frequencyMap]);

  // -------------------------------------------------------------------------
  // ADVANCED TAB PERCENTAGES (Calculated from current N rounds)
  // -------------------------------------------------------------------------
  const advancedStats = useMemo(() => {
    let zeroHits = 0;
    let dozen1 = 0; // 1-12
    let dozen2 = 0; // 13-24
    let dozen3 = 0; // 25-36

    let col1 = 0; // 1, 4, 7... 34
    let col2 = 0; // 2, 5, 8... 35
    let col3 = 0; // 3, 6, 9... 36

    let tierHits = 0;
    let orphelinsHits = 0;
    let voisinsHits = 0;
    let zeroSpielHits = 0;

    let low1_18 = 0;
    let high19_36 = 0;
    let evenHits = 0;
    let oddHits = 0;
    let redHits = 0;
    let blackHits = 0;

    const tierSet = new Set(FRENCH_BETS.tiers.numbers.map(String));
    const orphelinsSet = new Set(FRENCH_BETS.orphelins.numbers.map(String));
    const voisinsSet = new Set(FRENCH_BETS.voisins.numbers.map(String));
    const zeroSpielSet = new Set(FRENCH_BETS.zero.numbers.map(String));

    currentDataset.forEach(s => {
      const p = s.pocketNumber;
      const num = Number(p);

      if (p === 0 || p === '00') {
        zeroHits++;
      } else {
        // Dozens
        if (num >= 1 && num <= 12) dozen1++;
        else if (num >= 13 && num <= 24) dozen2++;
        else if (num >= 25 && num <= 36) dozen3++;

        // Columns
        if (num % 3 === 1) col1++;
        else if (num % 3 === 2) col2++;
        else if (num % 3 === 0) col3++;

        // Even / Odd
        if (num % 2 === 0) evenHits++;
        else oddHits++;

        // High / Low
        if (num >= 1 && num <= 18) low1_18++;
        else if (num >= 19 && num <= 36) high19_36++;

        // Red / Black
        if (RED_NUMBERS_SET.has(num)) redHits++;
        else blackHits++;
      }

      // French Call Bets
      const pStr = String(p);
      if (tierSet.has(pStr)) tierHits++;
      if (orphelinsSet.has(pStr)) orphelinsHits++;
      if (voisinsSet.has(pStr)) voisinsHits++;
      if (zeroSpielSet.has(pStr)) zeroSpielHits++;
    });

    const pct = (hits: number) => `${Math.round((hits / actualN) * 100)}%`;

    return {
      zero: pct(zeroHits),
      dozen1: pct(dozen1),
      dozen2: pct(dozen2),
      dozen3: pct(dozen3),
      col1: pct(col1),
      col2: pct(col2),
      col3: pct(col3),
      tier: pct(tierHits),
      orphelins: pct(orphelinsHits),
      voisins: pct(voisinsHits),
      zeroSpiel: pct(zeroSpielHits),
      low1_18: pct(low1_18),
      high19_36: pct(high19_36),
      even: pct(evenHits),
      odd: pct(oddHits),
      red: pct(redHits),
      black: pct(blackHits),
    };
  }, [currentDataset, actualN]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Helper for hover highlight styling
  const isMatch = (pocket: PocketValue) => String(pocket) === String(hoveredNumber);

  // Determines dynamic highlight background & text color based on number color
  const getCellHighlightClass = (pocket: PocketValue) => {
    const isHovered = isMatch(pocket);
    const color = getPocketColor(pocket);

    if (isHovered) {
      if (color === 'red') {
        return 'bg-[#dc2626] text-white font-black border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.8)] scale-105 z-10';
      }
      if (color === 'black') {
        return 'bg-[#94a3b8] text-black font-black border-white shadow-[0_0_12px_rgba(255,255,255,0.7)] scale-105 z-10';
      }
      return 'bg-[#16a34a] text-white font-black border-emerald-400 shadow-[0_0_12px_rgba(22,163,74,0.8)] scale-105 z-10';
    }

    // Default unhovered styling
    if (color === 'red') return 'border-neutral-800 bg-[#16191f] text-[#ef4444] font-bold';
    if (color === 'black') return 'border-neutral-800 bg-[#16191f] text-white font-bold';
    return 'border-neutral-800 bg-[#16191f] text-[#10b981] font-bold';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-[490px] bg-[#14171d] border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-white flex flex-col overflow-hidden">
        
        {/* ================================================================= */}
        {/* MODAL HEADER                                                      */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-end space-x-0.5 h-5 text-white">
              <span className="w-1 h-2.5 bg-white rounded-t-sm" />
              <span className="w-1 h-4 bg-white rounded-t-sm" />
              <span className="w-1 h-5 bg-white rounded-t-sm" />
              <span className="w-1 h-3 bg-white rounded-t-sm" />
            </div>
            <h2 className="text-xl font-bold tracking-wide text-white">Statistics</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* TABS HEADER: HOT/COLD | ADVANCED | LAST {N}                       */}
        {/* ================================================================= */}
        <div className="flex items-center justify-around border-b border-white/10 px-4 text-xs md:text-sm font-bold tracking-wider">
          {/* TAB 1: HOT/COLD */}
          <button
            onClick={() => setActiveTab('HOT/COLD')}
            className={`pb-2.5 px-3 transition-colors relative cursor-pointer ${
              activeTab === 'HOT/COLD' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            HOT/COLD
            {activeTab === 'HOT/COLD' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d2b4] rounded-full" />
            )}
          </button>

          {/* TAB 2: ADVANCED */}
          <button
            onClick={() => setActiveTab('ADVANCED')}
            className={`pb-2.5 px-3 transition-colors relative cursor-pointer ${
              activeTab === 'ADVANCED' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ADVANCED
            {activeTab === 'ADVANCED' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d2b4] rounded-full" />
            )}
          </button>

          {/* TAB 3: DYNAMIC LAST {N} */}
          <button
            onClick={() => setActiveTab('LAST_N')}
            className={`pb-2.5 px-3 transition-colors relative cursor-pointer ${
              activeTab === 'LAST_N' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            LAST {roundsCount}
            {activeTab === 'LAST_N' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d2b4] rounded-full" />
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* RECENT OUTCOME RIBBON (Present in all tabs)                       */}
        {/* ================================================================= */}
        <div className="px-5 py-3 flex items-center space-x-2 overflow-x-auto border-b border-white/5 [scrollbar-width:none]">
          {recentRibbon.map((s, idx) => {
            const isLatest = idx === 0;
            const p = s.pocketNumber;
            const color = getPocketColor(p);
            const isHovered = isMatch(p);

            // Latest item has a solid rectangular highlight box
            let frameClass = 'px-2 py-0.5 rounded text-sm md:text-base font-bold transition-all';
            if (isLatest) {
              frameClass += color === 'red'
                ? ' border border-red-500 bg-red-950/60 text-white shadow-sm'
                : color === 'black'
                ? ' border border-gray-300 bg-gray-900/80 text-white shadow-sm'
                : ' border border-emerald-500 bg-emerald-950/60 text-white shadow-sm';
            } else {
              if (color === 'red') frameClass += ' text-[#ef4444]';
              else if (color === 'black') frameClass += ' text-white';
              else frameClass += ' text-[#10b981]';
            }

            if (isHovered) {
              frameClass += color === 'red'
                ? ' bg-[#dc2626] !text-white font-black ring-2 ring-red-400'
                : color === 'black'
                ? ' bg-[#94a3b8] !text-black font-black ring-2 ring-white'
                : ' bg-[#16a34a] !text-white font-black ring-2 ring-emerald-400';
            }

            return (
              <span
                key={s.id || idx}
                onMouseEnter={() => setHoveredNumber(p)}
                onMouseLeave={() => setHoveredNumber(null)}
                className={`cursor-pointer shrink-0 font-mono ${frameClass}`}
              >
                {p}
              </span>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* TAB 1: HOT / COLD VIEW                                            */}
        {/* ================================================================= */}
        {activeTab === 'HOT/COLD' && (
          <div className="p-4 flex items-center justify-between min-h-[320px]">
            {/* Left Column: Top 5 HOT */}
            <div className="w-12 flex flex-col items-center space-y-3 shrink-0">
              <div className="w-11 h-11 bg-[#451214] border border-red-500/40 rounded-xl flex items-center justify-center shadow-md">
                <Flame className="w-6 h-6 text-white fill-white" />
              </div>

              <div className="flex flex-col items-center space-y-2 font-mono text-lg font-bold">
                {hotNumbers.map((num, i) => {
                  const color = getPocketColor(num);
                  const isHovered = isMatch(num);
                  return (
                    <span
                      key={i}
                      onMouseEnter={() => setHoveredNumber(num)}
                      onMouseLeave={() => setHoveredNumber(null)}
                      className={`cursor-pointer px-2 py-0.5 rounded transition ${
                        isHovered
                          ? color === 'red'
                            ? 'bg-[#dc2626] text-white font-black scale-110 shadow-md'
                            : 'bg-[#94a3b8] text-black font-black scale-110 shadow-md'
                          : color === 'red'
                          ? 'text-[#ef4444]'
                          : color === 'black'
                          ? 'text-white'
                          : 'text-[#10b981]'
                      }`}
                    >
                      {num}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Center: Circular Roulette Wheel Distribution Chart */}
            <div className="flex-1 flex items-center justify-center relative">
              <svg viewBox="0 0 280 280" className="w-[260px] h-[260px] select-none">
                <defs>
                  <radialGradient id="hubCenterGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#475569" />
                  </radialGradient>
                </defs>

                {/* Outer Wheel Ring Base */}
                <circle cx="140" cy="140" r="130" fill="none" stroke="#262c36" strokeWidth="22" />
                <circle cx="140" cy="140" r="119" fill="#14171d" />

                {/* Radial Frequency Bars and Numbers */}
                {EUR_WHEEL_SEQUENCE.map((pocket, idx) => {
                  const totalPockets = EUR_WHEEL_SEQUENCE.length;
                  // European sequence around circle
                  const angle = (idx / totalPockets) * 2 * Math.PI - Math.PI / 2;
                  const hits = frequencyMap[String(pocket)] || 0;
                  const color = getPocketColor(pocket);

                  // Pocket Number Position along ring
                  const textR = 130;
                  const tx = 140 + textR * Math.cos(angle);
                  const ty = 140 + textR * Math.sin(angle);

                  // Spoke Bar length proportional to frequency
                  const minBar = 12;
                  const maxBar = 75;
                  const barLen = minBar + (hits / maxHits) * (maxBar - minBar);

                  const barOuterR = 117;
                  const barInnerR = barOuterR - barLen;

                  const bx1 = 140 + barOuterR * Math.cos(angle);
                  const by1 = 140 + barOuterR * Math.sin(angle);
                  const bx2 = 140 + barInnerR * Math.cos(angle);
                  const by2 = 140 + barInnerR * Math.sin(angle);

                  const isHot = hotSet.has(String(pocket));
                  const isCold = coldSet.has(String(pocket));
                  const isHovered = isMatch(pocket);

                  let barStroke = '#2a313d'; // neutral dark grey
                  let barWidth = 4.5;

                  if (isHot) {
                    barStroke = '#ea580c'; // Red-orange hot spoke
                    barWidth = 6;
                  } else if (isCold) {
                    barStroke = '#0284c7'; // Blue cold spoke
                    barWidth = 5;
                  }

                  if (isHovered) {
                    barStroke = '#ffffff';
                    barWidth = 7;
                  }

                  return (
                    <g
                      key={`wheel-${pocket}`}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredNumber(pocket)}
                      onMouseLeave={() => setHoveredNumber(null)}
                    >
                      {/* Radial Spoke Bar */}
                      <line
                        x1={bx1}
                        y1={by1}
                        x2={bx2}
                        y2={by2}
                        stroke={barStroke}
                        strokeWidth={barWidth}
                        strokeLinecap="round"
                        className="transition-all"
                      />

                      {/* Pocket Number Label */}
                      <text
                        x={tx}
                        y={ty + 3}
                        textAnchor="middle"
                        fontSize={isHovered ? '11.5' : '9.5'}
                        fontWeight={isHovered ? '900' : '700'}
                        fontFamily="monospace"
                        fill={
                          isHovered
                            ? '#ffffff'
                            : color === 'red'
                            ? '#ef4444'
                            : color === 'black'
                            ? '#ffffff'
                            : '#10b981'
                        }
                      >
                        {pocket}
                      </text>
                    </g>
                  );
                })}

                {/* Center Hub Graphic */}
                <circle cx="140" cy="140" r="38" fill="#1e232c" stroke="#334155" strokeWidth="1" />
                <circle cx="140" cy="140" r="18" fill="#0f172a" />
                <circle cx="140" cy="140" r="7" fill="url(#hubCenterGrad)" />
              </svg>
            </div>

            {/* Right Column: Top 5 COLD */}
            <div className="w-12 flex flex-col items-center space-y-3 shrink-0">
              <div className="w-11 h-11 bg-[#0c2a42] border border-sky-500/40 rounded-xl flex items-center justify-center shadow-md">
                <Snowflake className="w-6 h-6 text-white" />
              </div>

              <div className="flex flex-col items-center space-y-2 font-mono text-lg font-bold">
                {coldNumbers.map((num, i) => {
                  const color = getPocketColor(num);
                  const isHovered = isMatch(num);
                  return (
                    <span
                      key={i}
                      onMouseEnter={() => setHoveredNumber(num)}
                      onMouseLeave={() => setHoveredNumber(null)}
                      className={`cursor-pointer px-2 py-0.5 rounded transition ${
                        isHovered
                          ? color === 'red'
                            ? 'bg-[#dc2626] text-white font-black scale-110 shadow-md'
                            : 'bg-[#94a3b8] text-black font-black scale-110 shadow-md'
                          : color === 'red'
                          ? 'text-[#ef4444]'
                          : color === 'black'
                          ? 'text-white'
                          : 'text-[#10b981]'
                      }`}
                    >
                      {num}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ADVANCED PERCENTAGES VIEW                                  */}
        {/* ================================================================= */}
        {activeTab === 'ADVANCED' && (
          <div className="p-4 flex flex-col space-y-3 min-h-[320px] justify-center">
            {/* Row 1: Zero | 1st Dozen | 2nd Dozen | 3rd Dozen */}
            <div className="grid grid-cols-12 gap-2 text-center">
              {/* ZERO */}
              <div className="col-span-2 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.zero}</span>
                <div className="w-full h-8 bg-[#008f39] rounded flex items-center justify-center text-white font-black text-sm shadow">
                  0
                </div>
              </div>
              {/* 1ST DOZEN */}
              <div className="col-span-3 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.dozen1}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  1ST DOZEN
                </div>
              </div>
              {/* 2ND DOZEN */}
              <div className="col-span-4 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.dozen2}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  2ND DOZEN
                </div>
              </div>
              {/* 3RD DOZEN */}
              <div className="col-span-3 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.dozen3}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  3RD DOZEN
                </div>
              </div>
            </div>

            {/* Row 2: 1st Column | 2nd Column | 3rd Column */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.col1}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  1ST COLUMN
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.col2}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  2ND COLUMN
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.col3}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  3RD COLUMN
                </div>
              </div>
            </div>

            {/* Row 3: French Call Bets: TIER | ORPHELINS | VOISINS | ZERO */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.tier}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  TIER
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.orphelins}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  ORPHELINS
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.voisins}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  VOISINS
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.zeroSpiel}</span>
                <div className="w-full h-8 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px] uppercase tracking-tight">
                  ZERO
                </div>
              </div>
            </div>

            {/* Row 4: 1-18 | EVEN | RED DIAMOND | BLACK DIAMOND | ODD | 19-36 */}
            <div className="grid grid-cols-6 gap-2 text-center">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.low1_18}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px]">
                  1–18
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.even}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px]">
                  EVEN
                </div>
              </div>
              {/* RED DIAMOND */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.red}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center">
                  <div className="w-5 h-5 bg-[#d32027] rotate-45 rounded-sm shadow-sm" />
                </div>
              </div>
              {/* BLACK DIAMOND */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.black}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center">
                  <div className="w-5 h-5 bg-[#111417] border border-white/30 rotate-45 rounded-sm shadow-sm" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.odd}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px]">
                  ODD
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{advancedStats.high19_36}</span>
                <div className="w-full h-11 bg-[#373c44] border border-white/10 rounded flex items-center justify-center text-white font-bold text-[11px]">
                  19–36
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: LAST {N} HISTORICAL NUMBERS MATRIX (Multi-Instance Hover)  */}
        {/* ================================================================= */}
        {activeTab === 'LAST_N' && (
          <div className="p-3 max-h-[330px] overflow-y-auto [scrollbar-width:thin]">
            <div className="grid grid-cols-12 gap-1.5 text-center">
              {currentDataset.map((s, idx) => {
                const p = s.pocketNumber;
                return (
                  <div
                    key={s.id || idx}
                    onMouseEnter={() => setHoveredNumber(p)}
                    onMouseLeave={() => setHoveredNumber(null)}
                    className={`h-7 rounded flex items-center justify-center font-mono text-xs border transition-transform cursor-pointer ${getCellHighlightClass(
                      p
                    )}`}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* BOTTOM RANGE SLIDER BAR: LAST {roundsCount} ROUNDS                */}
        {/* ================================================================= */}
        <div className="px-6 py-4 bg-[#0d1015] border-t border-white/10 flex flex-col space-y-2">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            LAST {roundsCount} ROUNDS
          </div>

          <div className="relative flex items-center pt-2 pb-1">
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={roundsCount}
              onChange={(e) => setRoundsCount(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#00d2b4]"
            />

            {/* Dynamic Badge Pill Positioned Over Slider */}
            <div
              style={{
                left: `calc(${((roundsCount - 10) / 490) * 100}% - 20px)`,
              }}
              className="absolute -top-1 pointer-events-none bg-neutral-200 text-black text-xs font-black px-2 py-0.5 rounded shadow-lg transition-all"
            >
              {roundsCount}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
