import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTrackerStore } from '../../stores/tracker.store';
import {
  Plus,
  Radio,
  ChevronDown,
  Search,
} from 'lucide-react';
import { RouletteWheelSVG } from './RouletteWheelSVG';
import { RouletteTableGrid } from './RouletteTableGrid';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// European wheel physical pocket sequence
const EUR_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
  13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1,
  20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// 6 Wheel Sector Ranges (indices into EUR_WHEEL)
const EUR_SEG_RANGES = [
  [0, 5],   // S1: 0, 32, 15, 19, 4, 21
  [6, 11],  // S2: 2, 25, 17, 34, 6, 27
  [12, 17], // S3: 13, 36, 11, 30, 8, 23
  [18, 23], // S4: 10, 5, 24, 16, 33, 1
  [24, 29], // S5: 20, 14, 31, 9, 22, 18
  [30, 36], // S6: 29, 7, 28, 12, 35, 3, 26
];

const getSectorForPocket = (pocket: number | '00'): number => {
  const pNum = Number(pocket);
  const idx = EUR_WHEEL.indexOf(pNum);
  if (idx < 0) return 1;
  for (let s = 0; s < EUR_SEG_RANGES.length; s++) {
    const [start, end] = EUR_SEG_RANGES[s];
    if (idx >= start && idx <= end) return s + 1;
  }
  return 1;
};

const getOffset = (start: number | '00', win: number | '00'): number => {
  const startIdx = EUR_WHEEL.indexOf(Number(start));
  const winIdx = EUR_WHEEL.indexOf(Number(win));
  if (startIdx < 0 || winIdx < 0) return 0;
  return (winIdx - startIdx + 37) % 37;
};

// ── Speedometer Confidence Gauge Matching Reference UI ──────────────────────
const SpeedometerGauge: React.FC<{ score: number }> = ({ score }) => {
  const clamp = Math.min(100, Math.max(0, score));
  // Needle angle: -180 deg (0 score) to 0 deg (100 score)
  const needleAngle = -180 + (clamp / 100) * 180;

  let rating = 'Very Low';
  let ratingColor = '#ef4444';
  if (clamp >= 75) {
    rating = 'High';
    ratingColor = '#10b981';
  } else if (clamp >= 50) {
    rating = 'Moderate';
    ratingColor = '#f59e0b';
  } else if (clamp >= 30) {
    rating = 'Low';
    ratingColor = '#f87171';
  }

  const cx = 70;
  const cy = 58;
  const r = 44;
  const toRad = (a: number) => (a * Math.PI) / 180;
  const nx = cx + (r - 8) * Math.cos(toRad(needleAngle));
  const ny = cy + (r - 8) * Math.sin(toRad(needleAngle));

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={68} viewBox="0 0 140 68" className="overflow-visible">
        <defs>
          <linearGradient id="speedoGradRef" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="35%" stopColor="#f87171" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {/* Background dark arc */}
        <path
          d="M 26 58 A 44 44 0 0 1 114 58"
          fill="none"
          stroke="#151d26"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {/* Color gradient track */}
        <path
          d="M 26 58 A 44 44 0 0 1 114 58"
          fill="none"
          stroke="url(#speedoGradRef)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Needle indicator line */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#ef4444"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="#ffffff" />
        <circle cx={cx} cy={cy} r="2.5" fill="#ef4444" />
      </svg>
      <div className="text-center mt-0.5">
        <div className="text-xs font-black tracking-wide" style={{ color: ratingColor }}>
          {rating}
        </div>
        <div className="text-[11px] font-mono text-zinc-400">
          Score <strong className="text-white font-bold">{clamp.toFixed(0)}</strong>
        </div>
      </div>
    </div>
  );
};

export const DealerTracker: React.FC = () => {
  const {
    activeSession,
    activeAnalytics,
    currentDirection,
    recordSpin,
    undoLastSpin,
    clearSessionSpins,
    createSession,
    fetchSessions,
    recentPocketsEntered,
    isFeedRunning,
    liveTables,
    boundTableId,
    fetchCasinoConfigs,
    startLiveFeed,
    fetchLiveTables,
    bindLiveTable,
    refreshActiveAnalytics,
    historyMode,
    setHistoryMode,
    selectedDealerName,
    fetchDealerHistoricalAnalytics,
    historicalStats,
    fetchHistoryStats,
  } = useTrackerStore();

  // Searchable Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownTab, setDropdownTab] = useState<'all' | 'tables' | 'dealers'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Neighbors toggle state: 6 or 8 (default: 6 matching reference UI)
  const [neighbors, setNeighbors] = useState<6 | 8>(6);

  // New session modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDealer, setNewDealer] = useState('');
  const [newTable, setNewTable] = useState('');

  // Initial load
  useEffect(() => {
    fetchSessions();
    fetchCasinoConfigs();
    fetchLiveTables();
    fetchHistoryStats();
  }, [fetchSessions, fetchCasinoConfigs, fetchLiveTables, fetchHistoryStats]);

  // Automatically start live feed if not active
  useEffect(() => {
    if (!isFeedRunning) {
      startLiveFeed();
    }
  }, [isFeedRunning, startLiveFeed]);

  // Auto-refresh when feed / bind active
  useEffect(() => {
    if (!isFeedRunning && !boundTableId) return;
    const interval = setInterval(() => {
      if (isFeedRunning) {
        fetchLiveTables();
        fetchHistoryStats();
      }
      refreshActiveAnalytics();
    }, 2500);
    return () => clearInterval(interval);
  }, [isFeedRunning, boundTableId, fetchLiveTables, fetchHistoryStats, refreshActiveAnalytics]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Extract active dealers dynamically from live tables + historical archive
  const activeDealers = useMemo(() => {
    const list: Array<{
      name: string;
      id?: string;
      tableId?: string;
      tableName?: string;
      lastResults: Array<{ result: string; color?: string }>;
      isLive: boolean;
      totalSpins?: number;
    }> = [];
    const seen = new Set<string>();

    // 1. Current active dealers on shift across 40 live tables
    for (const table of liveTables) {
      const dealerName = table.dealer?.name;
      if (dealerName && !seen.has(dealerName)) {
        seen.add(dealerName);
        list.push({
          name: dealerName,
          id: table.dealer?.id,
          tableId: table.tableId,
          tableName: table.tableName || `Roulette ${table.tableId}`,
          lastResults: table.lastResults || [],
          isLive: true,
        });
      }
    }

    // 2. Cumulative dealers from permanent historical ledger
    if (historicalStats?.dealers) {
      for (const d of historicalStats.dealers) {
        if (d.name && !seen.has(d.name)) {
          seen.add(d.name);
          list.push({
            name: d.name,
            lastResults: [],
            isLive: false,
            totalSpins: d.spins,
          });
        }
      }
    }

    return list;
  }, [liveTables, historicalStats]);

  // Filtered live tables
  const filteredLiveTables = useMemo(() => {
    if (!dropdownSearch.trim()) return liveTables;
    const q = dropdownSearch.toLowerCase();
    return liveTables.filter(
      (t) =>
        t.tableName.toLowerCase().includes(q) ||
        t.tableId.toLowerCase().includes(q) ||
        t.dealer?.name?.toLowerCase().includes(q)
    );
  }, [liveTables, dropdownSearch]);

  // Filtered dealers (both active on shift and historical archive)
  const filteredDealers = useMemo(() => {
    if (!dropdownSearch.trim()) return activeDealers;
    const q = dropdownSearch.toLowerCase();
    return activeDealers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.tableName && d.tableName.toLowerCase().includes(q)) ||
        (d.tableId && d.tableId.toLowerCase().includes(q))
    );
  }, [activeDealers, dropdownSearch]);

  // Active bound table object
  const boundTable = useMemo(() => {
    return liveTables.find((t) => t.tableId === boundTableId);
  }, [liveTables, boundTableId]);

  // Track a table from the dropdown
  const handleTrackTable = async (table: (typeof liveTables)[0]) => {
    setIsDropdownOpen(false);
    useTrackerStore.setState({
      boundTableId: table.tableId,
      selectedTableId: table.tableId,
      selectedDealerName: table.dealer?.name || null,
    });

    if (activeSession) {
      await bindLiveTable(table.tableId, activeSession.id);
    } else {
      await createSession(
        table.tableName || `Roulette ${table.tableId}`,
        'EUR',
        'Live Casino',
        table.tableId,
        table.dealer?.name
      );
      const allSessions = useTrackerStore.getState().sessions;
      if (allSessions.length > 0) {
        await bindLiveTable(table.tableId, allSessions[0].id);
      }
    }
    await setHistoryMode('table');
  };

  // Track a dealer from the dropdown
  const handleTrackDealer = async (dealer: (typeof activeDealers)[0]) => {
    setIsDropdownOpen(false);
    useTrackerStore.setState({
      selectedDealerName: dealer.name,
      boundTableId: dealer.tableId || null,
      selectedTableId: dealer.tableId || null,
    });

    if (dealer.tableId) {
      if (activeSession) {
        await bindLiveTable(dealer.tableId, activeSession.id);
      } else {
        await createSession(
          `Dealer - ${dealer.name}`,
          'EUR',
          'Live Casino',
          dealer.tableId,
          dealer.name
        );
        const allSessions = useTrackerStore.getState().sessions;
        if (allSessions.length > 0) {
          await bindLiveTable(dealer.tableId, allSessions[0].id);
        }
      }
    } else {
      // Historical dealer who is currently off-shift: create or set active session for analytics
      if (!activeSession) {
        await createSession(
          `Dealer - ${dealer.name}`,
          'EUR',
          'Live Casino',
          undefined,
          dealer.name
        );
      } else {
        useTrackerStore.setState({
          activeSession: { ...activeSession, dealer_name: dealer.name, label: `Dealer • ${dealer.name}` }
        });
      }
    }
    await setHistoryMode('dealer');
    await fetchDealerHistoricalAnalytics(dealer.name);
  };

  const handleCreateNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSession(
      newLabel || `${newTable || 'Table 1'} - ${newDealer || 'Live'}`,
      'EUR',
      'Live Casino',
      newTable,
      newDealer
    );
    setShowNewModal(false);
    setNewLabel('');
    setNewDealer('');
    setNewTable('');
    setIsDropdownOpen(false);
  };

  const topNumbers = useMemo(
    () => (activeAnalytics?.prediction?.top_numbers ?? []) as Array<number | '00'>,
    [activeAnalytics]
  );
  const lastNumber = recentPocketsEntered.length > 0 ? recentPocketsEntered[0] : null;
  const segmentStats = activeAnalytics?.segment_stats ?? [];

  // Center prediction target
  const centerPrediction = topNumbers.length > neighbors ? topNumbers[neighbors] : topNumbers[6] ?? null;
  const predictedTarget = centerPrediction !== null && centerPrediction !== undefined
    ? centerPrediction
    : recentPocketsEntered.length > 0
    ? topNumbers[6] ?? 15
    : 15;

  const confidenceScore = activeAnalytics?.prediction?.confidence_score ?? (recentPocketsEntered.length >= 3 ? 11 : 0);

  // Sector Counts & Dominant Sector Calculation
  const sectorCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    recentPocketsEntered.forEach((p) => {
      const s = getSectorForPocket(p);
      counts[s - 1]++;
    });
    return counts;
  }, [recentPocketsEntered]);

  const dominantSector = useMemo(() => {
    if (activeAnalytics?.prediction?.predicted_segment) {
      return activeAnalytics.prediction.predicted_segment;
    }
    let maxVal = -1;
    let maxIdx = 5; // default S5 matching reference UI if tied
    sectorCounts.forEach((c, i) => {
      if (c > maxVal) {
        maxVal = c;
        maxIdx = i + 1;
      }
    });
    return maxVal > 0 ? maxIdx : 5;
  }, [activeAnalytics, sectorCounts]);

  // Spin Log Data Structure matching reference UI
  const spinLogData = useMemo(() => {
    return recentPocketsEntered.map((pocket, idx) => {
      const prevPocket = idx + 1 < recentPocketsEntered.length ? recentPocketsEntered[idx + 1] : recentPocketsEntered[idx];
      const seq = recentPocketsEntered.length - idx;
      const offset = getOffset(prevPocket, pocket);
      const sector = getSectorForPocket(pocket);
      const isEven = idx % 2 === 0;
      const dir = isEven ? currentDirection : (currentDirection === 'cw' ? 'ccw' : 'cw');

      return {
        seq,
        start: prevPocket,
        win: pocket,
        offset,
        sector: `S${sector}`,
        dir,
      };
    });
  }, [recentPocketsEntered, currentDirection]);

  // Display label for the dropdown button
  const selectionLabel = useMemo(() => {
    if (historyMode === 'dealer') {
      const dName = selectedDealerName || activeSession?.dealer_name || boundTable?.dealer?.name;
      return dName ? `👤 ${dName} (Dealer)` : 'Select Dealer';
    }
    if (historyMode === 'table') {
      if (boundTable) {
        return `🎡 ${boundTable.tableName}`;
      }
      if (boundTableId) {
        return `🎡 Table ${boundTableId}`;
      }
      return 'Select Table';
    }
    if (boundTable) {
      return `${boundTable.tableName}${boundTable.dealer?.name ? ` • ${boundTable.dealer.name}` : ''}`;
    }
    if (activeSession?.dealer_name) {
      return `${activeSession.label} • ${activeSession.dealer_name}`;
    }
    if (activeSession) {
      return activeSession.label;
    }
    return 'Select Table / Dealer';
  }, [historyMode, selectedDealerName, boundTable, boundTableId, activeSession]);

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#070b0e] text-white flex flex-col font-sans select-none pb-12">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER: DEALER SIGNATURE ANALYTICS & SEARCHABLE DROPDOWN
          ═══════════════════════════════════════════════════════════════════════ */}
      <header className="px-5 md:px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Gold Title & History Scope Badge */}
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="text-xl md:text-2xl font-black text-[#f59e0b] tracking-tight">
            Dealer Signature Analytics
          </h1>

          <div className="px-3.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold">
            {historyMode === 'session' && `${recentPocketsEntered.length}/50 spins tracked today`}
            {historyMode === 'dealer' && `${activeAnalytics?.total_spins || recentPocketsEntered.length} dealer signature spins (${activeAnalytics?.context_name || boundTable?.dealer?.name || 'Dealer'})`}
            {historyMode === 'table' && `${activeAnalytics?.total_spins || recentPocketsEntered.length} wheel mechanical spins (${activeAnalytics?.context_name || boundTable?.tableName || 'Table'})`}
          </div>
        </div>

        {/* Center: History Scope Segmented Toggle */}
        <div className="flex items-center bg-[#0a1218] border border-white/10 p-1 rounded-xl gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setHistoryMode('session')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              historyMode === 'session'
                ? 'bg-[#f59e0b] text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Live Shift</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryMode('dealer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              historyMode === 'dealer'
                ? 'bg-purple-500 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Analyze cumulative dealer signature bias across all tables"
          >
            <span>👤 Dealer Signature</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              historyMode === 'table'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Analyze physical wheel mechanical bias across all dealers"
          >
            <span>🎡 Table Wheel</span>
          </button>
        </div>

        {/* Right: Searchable Table / Dealer Dropdown Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0e141c] hover:bg-[#141d27] border border-white/15 hover:border-amber-400/40 rounded-xl text-xs font-bold text-gray-200 transition cursor-pointer shadow-lg"
          >
            {boundTableId ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="max-w-[220px] truncate">{selectionLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* ─ DROPDOWN POPOVER ─ */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0a1218] border border-white/15 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3">
              {/* Search Field */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={dropdownSearch}
                  onChange={(e) => setDropdownSearch(e.target.value)}
                  placeholder="Search tables or dealers..."
                  className="w-full bg-[#101822] border border-white/15 focus:border-[#f59e0b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none"
                  autoFocus
                />
              </div>

              {/* Segmented Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDropdownTab('all')}
                  className={`flex-1 py-1 rounded-md transition ${dropdownTab === 'all' ? 'bg-[#f59e0b] text-black font-black' : 'text-gray-400 hover:text-white'}`}
                >
                  All ({filteredLiveTables.length + filteredDealers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDropdownTab('tables')}
                  className={`flex-1 py-1 rounded-md transition ${dropdownTab === 'tables' ? 'bg-[#f59e0b] text-black font-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Tables ({filteredLiveTables.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDropdownTab('dealers')}
                  className={`flex-1 py-1 rounded-md transition ${dropdownTab === 'dealers' ? 'bg-[#f59e0b] text-black font-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Dealers ({filteredDealers.length})
                </button>
              </div>

              {/* Scrollable Results List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {/* ─ Section: Live Tables ─ */}
                {(dropdownTab === 'all' || dropdownTab === 'tables') && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1 pt-1">
                      Live Roulette Tables
                    </div>
                    {filteredLiveTables.length > 0 ? (
                      filteredLiveTables.map((table) => {
                        const isBound = boundTableId === table.tableId;
                        return (
                          <button
                            key={table.tableId}
                            type="button"
                            onClick={() => handleTrackTable(table)}
                            className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 group cursor-pointer border ${
                              isBound
                                ? 'bg-cyan-500/15 border-cyan-500/30'
                                : 'hover:bg-white/10 border-transparent hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white group-hover:text-amber-300 truncate">
                                  {table.tableName}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
                                  <span>#{table.tableId}</span>
                                  {table.dealer?.name && (
                                    <>
                                      <span>•</span>
                                      <span className="text-gray-300">👤 {table.dealer.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isBound ? (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-400 text-black text-[10px] font-black shrink-0">
                                Active
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 shrink-0 font-medium">
                                Track &rarr;
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-500 italic py-2 px-1">No tables match search</div>
                    )}
                  </div>
                )}

                {/* ─ Section: Live Dealers ─ */}
                {(dropdownTab === 'all' || dropdownTab === 'dealers') && (
                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">
                      Dealers (Active & Historical)
                    </div>
                    {filteredDealers.length > 0 ? (
                      filteredDealers.map((dealer) => {
                        const isBound = dealer.tableId ? boundTableId === dealer.tableId : false;
                        return (
                          <button
                            key={dealer.name + (dealer.tableId || 'hist')}
                            type="button"
                            onClick={() => handleTrackDealer(dealer)}
                            className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 group cursor-pointer border ${
                              isBound
                                ? 'bg-purple-500/15 border-purple-500/30'
                                : 'hover:bg-white/10 border-transparent hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 text-purple-300 font-black text-xs">
                                {dealer.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white group-hover:text-amber-300 truncate flex items-center gap-1.5">
                                  <span>{dealer.name}</span>
                                  {dealer.isLive ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Live on table now" />
                                  ) : (
                                    <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-white/10 text-gray-400">Off-Shift</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate">
                                  {dealer.isLive ? `At: ${dealer.tableName}` : `${dealer.totalSpins || 0} historical spins saved`}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 shrink-0 font-medium">
                              Analyze &rarr;
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-500 italic py-2 px-1">No dealers match search</div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: Create Custom Session */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ New Custom Tracking Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN DASHBOARD: 2-COLUMN LAYOUT MATCHING REFERENCE UI
          ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 px-5 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

        {/* ─────── LEFT COLUMN: ROULETTE WHEEL, TELEMETRY & SPIN LOG ─────── */}
        <div className="lg:col-span-7 flex flex-col gap-5 min-w-0">

          {/* ─ CARD 1: ROULETTE WHEEL & PREDICTIVE TELEMETRY ─ */}
          <div className="bg-[#0a0f14] border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col gap-5">
            {/* Header: Roulette Wheel + NEIGHBORS selector */}
            <div className="flex items-center justify-between">
              <span className="text-[#f59e0b] font-bold text-sm tracking-wide">
                Roulette Wheel
              </span>

              {/* Neighbors Toggle: 6 vs 8 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  NEIGHBORS
                </span>
                <div className="flex items-center bg-[#101822] border border-white/15 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setNeighbors(6)}
                    className={`px-2.5 py-0.5 text-xs font-black rounded-md transition cursor-pointer ${
                      neighbors === 6
                        ? 'bg-[#f59e0b] text-black shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    6
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeighbors(8)}
                    className={`px-2.5 py-0.5 text-xs font-black rounded-md transition cursor-pointer ${
                      neighbors === 8
                        ? 'bg-[#f59e0b] text-black shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    8
                  </button>
                </div>
              </div>
            </div>

            {/* Wheel & Predictions Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Authentic Roulette Wheel with 6 Purple Sectors & Center Medallion */}
              <div className="flex items-center justify-center shrink-0">
                <RouletteWheelSVG
                  lastNumber={lastNumber !== null ? (lastNumber as number | '00') : null}
                  topNumbers={topNumbers}
                  segmentStats={segmentStats}
                  rules="EUR"
                  size={310}
                  predictedSector={dominantSector}
                />
              </div>

              {/* Stacked Telemetry Boxes: Predicted Target & Confidence Gauge */}
              <div className="flex flex-col gap-4 w-full sm:w-48 shrink-0">
                {/* ─ Box 1: PREDICTED TARGET ─ */}
                <div className="bg-[#0d131a] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                    PREDICTED TARGET
                  </span>
                  <div className="w-16 h-16 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shadow-inner">
                    <span className="text-3xl font-serif font-black text-white">
                      {predictedTarget !== null ? String(predictedTarget) : '--'}
                    </span>
                  </div>
                </div>

                {/* ─ Box 2: CONFIDENCE SPEEDOMETER GAUGE ─ */}
                <div className="bg-[#0d131a] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    CONFIDENCE
                  </span>
                  <SpeedometerGauge score={confidenceScore} />
                </div>
              </div>
            </div>

            {/* ─ RECENT LANDINGS FILMSTRIP TAPE ─ */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                RECENT
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {recentPocketsEntered.length > 0 ? (
                  recentPocketsEntered.slice(0, 20).map((p, idx) => {
                    const isG = p === 0 || p === '00';
                    const isR = !isG && RED_NUMBERS.has(Number(p));
                    const isTargetHit = String(predictedTarget) === String(p);

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1 shrink-0">
                        {/* Dot indicator */}
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isTargetHit
                              ? 'bg-[#00f2fe] shadow-[0_0_4px_#00f2fe]'
                              : idx === 0
                              ? 'bg-amber-400'
                              : 'bg-transparent'
                          }`}
                        />
                        <span
                          className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg font-mono text-xs font-black border transition ${
                            isG
                              ? 'bg-[#008f39] border-emerald-500 text-white'
                              : isR
                              ? 'bg-[#c8191d] border-red-600 text-white'
                              : 'bg-[#111417] border-zinc-700 text-white'
                          } ${
                            idx === 0
                              ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                              : ''
                          }`}
                        >
                          {p}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-zinc-500 italic py-1">
                    No spins recorded yet. Type or click numbers on felt to begin.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ─ CARD 2: SPIN LOG TABLE ─ */}
          <div className="bg-[#0a0f14] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col">
            <span className="text-[11px] font-black text-gray-400 tracking-wider uppercase mb-3">
              SPIN LOG
            </span>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-bold text-[11px]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Start</th>
                    <th className="py-2.5 px-3">Win</th>
                    <th className="py-2.5 px-3">Offset</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3">Dir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {spinLogData.length > 0 ? (
                    spinLogData.slice(0, 10).map((row) => {
                      const isG = row.win === 0 || row.win === '00';
                      const isR = !isG && RED_NUMBERS.has(Number(row.win));

                      return (
                        <tr key={row.seq} className="hover:bg-white/[0.02] transition">
                          <td className="py-2.5 px-3 text-gray-400 font-bold">{row.seq}</td>
                          <td className="py-2.5 px-3 text-white">{row.start}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-black inline-block text-center min-w-[28px] ${
                                isG
                                  ? 'bg-[#008f39] text-white'
                                  : isR
                                  ? 'bg-[#c8191d] text-white'
                                  : 'bg-[#182029] border border-white/15 text-white'
                              }`}
                            >
                              {row.win}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#00f2fe] font-bold">{row.offset}</td>
                          <td className="py-2.5 px-3 text-gray-300 font-sans font-bold">{row.sector}</td>
                          <td className="py-2.5 px-3 text-gray-400 uppercase text-[11px] font-sans">
                            {row.dir}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-gray-500 italic font-sans">
                        No spin history recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─────── RIGHT COLUMN: BETTING FELT CONSOLE & SECTOR ANALYSIS ─────── */}
        <div className="lg:col-span-5 flex flex-col gap-5 min-w-0">

          {/* ─ CARD 1: ENTER WINNING NUMBER & INTERACTIVE BETTING FELT ─ */}
          <div className="bg-[#0a0f14] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <span className="text-[#f59e0b] font-bold text-sm tracking-wide">
              Enter Winning Number
            </span>

            <RouletteTableGrid
              topNumbers={topNumbers}
              lastNumber={lastNumber !== null ? (lastNumber as number | '00') : null}
              targetNumber={predictedTarget}
              isUsa={false}
              onSpin={(n) => recordSpin(n)}
              onUndo={undoLastSpin}
              onClear={clearSessionSpins}
              recentNumbers={recentPocketsEntered}
            />
          </div>

          {/* ─ CARD 2: SECTOR ANALYSIS HORIZONTAL DISTRIBUTION BARS ─ */}
          <div className="bg-[#0a0f14] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#00f2fe] font-black text-xs uppercase tracking-wider">
                SECTOR ANALYSIS
              </span>
              <span className="text-gray-400 font-mono text-xs">
                {recentPocketsEntered.length} spins
              </span>
            </div>

            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((sNum) => {
                const count = sectorCounts[sNum - 1];
                const isDominant = sNum === dominantSector;
                const isRelease = sNum === 1;
                const label = isRelease ? 'S1 (Release)' : `S${sNum}`;
                const maxCount = Math.max(...sectorCounts, 1);
                const widthPct = recentPocketsEntered.length > 0 ? Math.max(6, (count / maxCount) * 100) : 6;

                return (
                  <div key={sNum} className="flex items-center gap-3 text-xs">
                    <span
                      className={`w-24 shrink-0 font-sans ${
                        isDominant ? 'text-[#00f2fe] font-black' : 'text-gray-300 font-bold'
                      }`}
                    >
                      {label}
                    </span>
                    <div className="flex-1 h-3.5 bg-white/[0.04] rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isDominant
                            ? 'bg-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.6)]'
                            : 'bg-[#1e3a5f]'
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span
                      className={`w-6 text-right font-mono font-bold ${
                        isDominant ? 'text-[#00f2fe]' : 'text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ── MODAL: CREATE CUSTOM SESSION ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white">Create New Tracking Session</h3>
            <form onSubmit={handleCreateNewSession} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 font-bold mb-1">Session Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. VIP Roulette Evening"
                  className="w-full bg-[#101822] border border-white/15 focus:border-[#f59e0b] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1">Dealer Name (Optional)</label>
                <input
                  type="text"
                  value={newDealer}
                  onChange={(e) => setNewDealer(e.target.value)}
                  placeholder="e.g. Elena V."
                  className="w-full bg-[#101822] border border-white/15 focus:border-[#f59e0b] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 font-bold mb-1">Table Name or ID (Optional)</label>
                <input
                  type="text"
                  value={newTable}
                  onChange={(e) => setNewTable(e.target.value)}
                  placeholder="e.g. Roulette Monaco"
                  className="w-full bg-[#101822] border border-white/15 focus:border-[#f59e0b] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-extrabold rounded-xl shadow-lg cursor-pointer"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
