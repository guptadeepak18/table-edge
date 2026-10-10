import { create } from 'zustand';
import { audioService } from '../services/audio.service';

export type SpinDirection = 'cw' | 'ccw';
export type PocketValue = number | '00';

export interface SegmentStat {
  segment_index: number; // 1 to 6
  pocket_count: number;
  pockets: PocketValue[];
  hit_count: number;
  hit_percentage: number;
  z_score: number;
}

export interface SectorPrediction {
  predicted_segment: number;
  confidence_score: number;
  top_numbers: PocketValue[];
  dominant_offset?: number;
  rationale: string;
}

export interface LiveSessionAnalytics {
  total_spins: number;
  straight_frequency: Record<string, number>;
  rolling_hot: PocketValue[];
  rolling_cold: PocketValue[];
  segment_stats: SegmentStat[];
  offset_distribution: Record<number, number>;
  dominant_offset?: number;
  prediction?: SectorPrediction;
  recent_spins?: PocketValue[];
  context_type?: 'session' | 'dealer' | 'table';
  context_name?: string;
  distinct_dealers?: string[];
  distinct_tables?: string[];
}

export interface PragmaticTableMeta {
  tableId: string;
  tableName: string;
  tableType: string;
  dealer?: { name: string; id?: string } | null;
  lastResults?: Array<{ result: string; color?: string; time?: string; gameId?: string }>;
  updatedAt?: string;
}

export interface CasinoOperatorConfig {
  id: string;
  name: string;
  casino_id: string;
  provider: string;
  is_default: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface LiveTrackingSession {
  id: string;
  rules: 'EUR' | 'USA';
  casino?: string;
  table_id?: string;
  dealer_name?: string;
  label: string;
  started_at: string;
}

interface TrackerState {
  sessions: LiveTrackingSession[];
  activeSession: LiveTrackingSession | null;
  activeAnalytics: LiveSessionAnalytics | null;
  currentDirection: SpinDirection;
  recentPocketsEntered: PocketValue[];
  isLoading: boolean;
  isFeedRunning: boolean;
  liveTables: PragmaticTableMeta[];
  boundTableId: string | null;
  casinoConfigs: CasinoOperatorConfig[];
  selectedCasinoId: string;
  selectedDealerName: string | null;
  selectedTableId: string | null;
  historyMode: 'session' | 'dealer' | 'table';
  historicalStats: {
    total_spins: number;
    dealers: Array<{ name: string; spins: number }>;
    tables: Array<{ id: string; name: string; spins: number }>;
  } | null;

  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (label: string, rules: 'EUR' | 'USA', casino?: string, tableId?: string, dealer?: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  refreshActiveAnalytics: () => Promise<void>;
  setSpinDirection: (direction: SpinDirection) => void;
  recordSpin: (pocket: PocketValue) => Promise<void>;
  undoLastSpin: () => Promise<void>;
  clearSessionSpins: () => Promise<void>;
  fetchCasinoConfigs: () => Promise<void>;
  setSelectedCasinoId: (casinoId: string) => void;
  startLiveFeed: (casinoId?: string, tableKeys?: string[]) => Promise<void>;
  stopLiveFeed: () => Promise<void>;
  fetchLiveTables: () => Promise<void>;
  bindLiveTable: (tableId: string, sessionId: string) => Promise<void>;
  setHistoryMode: (mode: 'session' | 'dealer' | 'table') => Promise<void>;
  fetchDealerHistoricalAnalytics: (dealerName: string) => Promise<void>;
  fetchTableHistoricalAnalytics: (tableId: string) => Promise<void>;
  fetchHistoryStats: () => Promise<void>;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  sessions: [],
  activeSession: null,
  activeAnalytics: null,
  currentDirection: 'cw',
  recentPocketsEntered: [],
  isLoading: false,
  isFeedRunning: false,
  liveTables: [],
  boundTableId: null,
  casinoConfigs: [],
  selectedCasinoId: 'ppcdk00000003716',
  selectedDealerName: null,
  selectedTableId: null,
  historyMode: 'session',
  historicalStats: null,


  fetchSessions: async () => {
    try {
      const res = await fetch('/api/tracker/sessions');
      if (res.ok) {
        const data = await res.json();
        set({ sessions: data });
        if (data.length > 0 && !get().activeSession) {
          get().selectSession(data[0].id);
        }
      }
    } catch (e) {
      console.warn("Tracker sessions fetch failed:", e);
    }
  },

  createSession: async (label, rules, casino, tableId, dealer) => {
    try {
      if (tableId) {
        const table = get().liveTables.find(t => t.tableId === tableId);
        if (table && table.lastResults && table.lastResults.length > 0) {
          const initialPockets: PocketValue[] = table.lastResults.map(r => Number(r.result));
          set({ boundTableId: tableId, recentPocketsEntered: initialPockets });
        }
      }

      const res = await fetch('/api/tracker/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label || `Table ${tableId || '1'} - ${dealer || 'Live'}`,
          rules,
          casino,
          table_id: tableId,
          dealer_name: dealer,
        }),
      });
      if (res.ok) {
        const session = await res.json();
        set({
          sessions: [session, ...get().sessions],
          activeSession: session,
          boundTableId: session.table_id || null,
        });
        await get().selectSession(session.id);
      }
    } catch (e) {
      console.error("Create session error:", e);
    }
  },

  selectSession: async (sessionId: string) => {
    set({ isLoading: true });
    try {
      const sess = get().sessions.find(s => s.id === sessionId) || null;
      const res = await fetch(`/api/tracker/sessions/${sessionId}/analytics`);
      if (res.ok) {
        const analytics = await res.json();
        const recentPockets: PocketValue[] = (analytics.recent_spins && analytics.recent_spins.length > 0)
          ? analytics.recent_spins
          : [];

        // If the session has a bound table but 0 spins, self-heal by bootstrapping from liveTables
        if (sess?.table_id && recentPockets.length === 0) {
          const table = get().liveTables.find(t => t.tableId === sess.table_id);
          if (table && table.lastResults && table.lastResults.length > 0) {
            get().bindLiveTable(sess.table_id, sessionId);
          }
        }

        set({
          activeSession: sess,
          activeAnalytics: analytics,
          boundTableId: sess?.table_id || null,
          recentPocketsEntered: recentPockets,
          isLoading: false,
        });
      } else {
        set({ activeSession: sess, boundTableId: sess?.table_id || null, isLoading: false });
      }
    } catch (e) {
      console.error("Analytics fetch error:", e);
      set({ isLoading: false });
    }
  },

  setSpinDirection: (direction: SpinDirection) => {
    set({ currentDirection: direction });
  },

  recordSpin: async (pocket: PocketValue) => {
    const { activeSession, currentDirection, recentPocketsEntered } = get();
    if (!activeSession) return;

    audioService.playChipClick();

    try {
      const res = await fetch(`/api/tracker/sessions/${activeSession.id}/spins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pocket_number: pocket,
          direction: currentDirection,
        }),
      });

      if (res.ok) {
        const analytics = await res.json();
        // Toggle direction automatically for next spin (standard casino dealer alternation)
        const nextDir = currentDirection === 'cw' ? 'ccw' : 'cw';
        set({
          activeAnalytics: analytics,
          currentDirection: nextDir,
          recentPocketsEntered: [pocket, ...recentPocketsEntered].slice(0, 30),
        });
      }
    } catch (e) {
      console.error("Record spin error:", e);
    }
  },

  undoLastSpin: async () => {
    const { activeSession, currentDirection, recentPocketsEntered } = get();
    if (!activeSession || recentPocketsEntered.length === 0) return;
    try {
      const res = await fetch(`/api/tracker/sessions/${activeSession.id}/spins/last`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const analytics = await res.json();
        const prevDir = currentDirection === 'cw' ? 'ccw' : 'cw';
        set({
          activeAnalytics: analytics,
          currentDirection: prevDir,
          recentPocketsEntered: recentPocketsEntered.slice(1),
        });
      }
    } catch (e) {
      console.error("Undo last spin error:", e);
    }
  },

  clearSessionSpins: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/tracker/sessions/${activeSession.id}/spins`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const analytics = await res.json();
        set({
          activeAnalytics: analytics,
          recentPocketsEntered: [],
        });
      }
    } catch (e) {
      console.error("Clear session spins error:", e);
    }
  },

  refreshActiveAnalytics: async () => {
    const { activeSession, historyMode, boundTableId, selectedTableId, selectedDealerName, liveTables } = get();
    if (historyMode === 'dealer') {
      const dealer = selectedDealerName || activeSession?.dealer_name || (boundTableId ? liveTables.find(t => t.tableId === boundTableId)?.dealer?.name : null);
      if (dealer) {
        await get().fetchDealerHistoricalAnalytics(dealer);
        return;
      }
    } else if (historyMode === 'table') {
      const tableId = boundTableId || selectedTableId || activeSession?.table_id;
      if (tableId) {
        await get().fetchTableHistoricalAnalytics(tableId);
        return;
      }
    }

    if (!activeSession) return;
    try {
      const res = await fetch(`/api/tracker/sessions/${activeSession.id}/analytics`);
      if (res.ok) {
        const analytics = await res.json();
        const updates: Partial<TrackerState> = { activeAnalytics: analytics };
        if (analytics.recent_spins && analytics.recent_spins.length > 0) {
          updates.recentPocketsEntered = analytics.recent_spins;
        }
        set(updates);
      }
    } catch (e) {
      console.warn("Analytics refresh failed:", e);
    }
  },

  fetchCasinoConfigs: async () => {
    try {
      const res = await fetch('/api/tracker/casinos');
      if (res.ok) {
        const data: CasinoOperatorConfig[] = await res.json();
        set({ casinoConfigs: data });
        const defaultCfg = data.find((c) => c.is_default);
        if (defaultCfg) {
          set({ selectedCasinoId: defaultCfg.casino_id });
        } else if (data.length > 0 && !get().selectedCasinoId) {
          set({ selectedCasinoId: data[0].casino_id });
        }
      }
    } catch (e) {
      console.warn("Casino configs fetch failed:", e);
    }
  },

  setSelectedCasinoId: (casinoId: string) => {
    set({ selectedCasinoId: casinoId });
  },

  startLiveFeed: async (casinoId, tableKeys) => {
    try {
      const activeCasinoId = casinoId || get().selectedCasinoId || undefined;
      const res = await fetch('/api/tracker/live-feed/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: activeCasinoId, table_keys: tableKeys }),
      });
      if (res.ok) {
        set({ isFeedRunning: true });
        get().fetchLiveTables();
      }
    } catch (e) {
      console.error("Start live feed error:", e);
    }
  },

  stopLiveFeed: async () => {
    try {
      await fetch('/api/tracker/live-feed/stop', { method: 'POST' });
      set({ isFeedRunning: false });
    } catch (e) {
      console.error("Stop live feed error:", e);
    }
  },

  fetchLiveTables: async () => {
    try {
      const res = await fetch('/api/tracker/live-feed/tables');
      if (res.ok) {
        const tables = await res.json();
        set({ liveTables: tables });
      }
    } catch (e) {
      console.warn("Fetch live tables failed:", e);
    }
  },

  bindLiveTable: async (tableId: string, sessionId: string) => {
    try {
      set({ boundTableId: tableId, selectedTableId: tableId });

      const res = await fetch('/api/tracker/live-feed/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analytics) {
          set({
            boundTableId: tableId,
            selectedTableId: tableId,
            activeAnalytics: data.analytics,
            recentPocketsEntered: (data.analytics.recent_spins && data.analytics.recent_spins.length > 0)
              ? data.analytics.recent_spins
              : get().recentPocketsEntered,
          });
        }
        await get().fetchSessions();
      }
    } catch (e) {
      console.error("Bind table error:", e);
    }
  },

  setHistoryMode: async (mode: 'session' | 'dealer' | 'table') => {
    set({ historyMode: mode });
    const { activeSession, boundTableId, selectedTableId, selectedDealerName, liveTables } = get();
    if (mode === 'session') {
      if (activeSession) {
        await get().refreshActiveAnalytics();
      }
    } else if (mode === 'dealer') {
      const dealer = selectedDealerName || activeSession?.dealer_name || (boundTableId ? liveTables.find(t => t.tableId === boundTableId)?.dealer?.name : null);
      if (dealer) {
        await get().fetchDealerHistoricalAnalytics(dealer);
      }
    } else if (mode === 'table') {
      const tableId = boundTableId || selectedTableId || activeSession?.table_id;
      if (tableId) {
        await get().fetchTableHistoricalAnalytics(tableId);
      }
    }
  },

  fetchDealerHistoricalAnalytics: async (dealerName: string) => {
    try {
      const res = await fetch(`/api/tracker/history/dealer/${encodeURIComponent(dealerName)}/analytics`);
      if (res.ok) {
        const analytics = await res.json();
        set({
          selectedDealerName: dealerName,
          activeAnalytics: analytics,
          recentPocketsEntered: (analytics.recent_spins && analytics.recent_spins.length > 0)
            ? analytics.recent_spins
            : get().recentPocketsEntered,
        });
      }
    } catch (e) {
      console.warn("Dealer history fetch failed:", e);
    }
  },

  fetchTableHistoricalAnalytics: async (tableId: string) => {
    try {
      const res = await fetch(`/api/tracker/history/table/${encodeURIComponent(tableId)}/analytics`);
      if (res.ok) {
        const analytics = await res.json();
        set({
          boundTableId: tableId,
          selectedTableId: tableId,
          activeAnalytics: analytics,
          recentPocketsEntered: (analytics.recent_spins && analytics.recent_spins.length > 0)
            ? analytics.recent_spins
            : get().recentPocketsEntered,
        });
      }
    } catch (e) {
      console.warn("Table history fetch failed:", e);
    }
  },

  fetchHistoryStats: async () => {
    try {
      const res = await fetch('/api/tracker/history/stats');
      if (res.ok) {
        const stats = await res.json();
        set({ historicalStats: stats });
      }
    } catch (e) {
      console.warn("History stats fetch failed:", e);
    }
  },
}));
