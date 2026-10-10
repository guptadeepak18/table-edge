import type { BetPlacement, BetStrategy, ProgressionLevel } from '../stores/simulator.store';

const API_BASE = '/api';

const STANDARD_ROULETTE_PAYOUTS: Record<string, number> = {
  straight: 35,
  single: 35,
  split: 17,
  street: 11,
  trio: 11,
  corner: 8,
  square: 8,
  basket: 8,
  first_four: 8,
  first_five: 6,
  sixline: 5,
  line: 5,
  double_street: 5,
  dozen: 2,
  dozen_1: 2,
  dozen_2: 2,
  dozen_3: 2,
  doz1: 2,
  doz2: 2,
  doz3: 2,
  doz_1: 2,
  doz_2: 2,
  doz_3: 2,
  '1st 12': 2,
  '2nd 12': 2,
  '3rd 12': 2,
  first_twelve: 2,
  second_twelve: 2,
  third_twelve: 2,
  column: 2,
  column_1: 2,
  column_2: 2,
  column_3: 2,
  col_1: 2,
  col_2: 2,
  col_3: 2,
  col1: 2,
  col2: 2,
  col3: 2,
  outside_red: 1,
  outside_black: 1,
  outside_even: 1,
  outside_odd: 1,
  outside_low: 1,
  outside_high: 1,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
};

export function normalizePlacement(p: any): BetPlacement {
  const betType = p.betType || p.bet_type || 'straight';
  const defaultMult = STANDARD_ROULETTE_PAYOUTS[betType] || 1;
  const rawMult = Number(p.multiplier);
  const multiplier = defaultMult > 1 ? defaultMult : (!isNaN(rawMult) && rawMult > 0 ? rawMult : defaultMult);
  return {
    id: p.id || `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    betType,
    coordinateX: p.coordinateX ?? p.coordinate_x ?? 0,
    coordinateY: p.coordinateY ?? p.coordinate_y ?? 0,
    coveredPockets: (p.coveredPockets || p.covered_pockets || []).map((v: any) => (v === '00' ? '00' : Number(v))),
    amount: Number(p.amount || 0),
    multiplier,
  };
}

export function normalizeLevel(l: any): ProgressionLevel {
  const placements = (l.placements || []).map(normalizePlacement);
  const totalWager = Number(
    l.totalWager ?? l.total_wager ?? placements.reduce((s: number, p: BetPlacement) => s + p.amount, 0)
  );
  return {
    levelNumber: Number(l.levelNumber ?? l.level_number ?? 1),
    totalWager,
    placements,
  };
}

export function normalizeStrategy(s: any): BetStrategy {
  return {
    id: String(s.id),
    name: s.name || 'Untitled Strategy',
    description: s.description || '',
    createdAt: typeof s.created_at === 'string' ? new Date(s.created_at).getTime() : (s.createdAt || Date.now()),
    levels: (s.levels || []).map(normalizeLevel),
  };
}

function formatStrategyPayload(name: string, rules: string, levels: ProgressionLevel[]) {
  return {
    name: name.trim(),
    rules: rules || 'EUR',
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
  };
}

export const strategyService = {
  async fetchStrategies(): Promise<BetStrategy[]> {
    try {
      const res = await fetch(`${API_BASE}/strategies`);
      if (!res.ok) {
        console.warn(`Failed to fetch strategies: HTTP ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map(normalizeStrategy);
    } catch (err) {
      console.warn('Network error fetching strategies from database:', err);
      return [];
    }
  },

  async createStrategy(name: string, rules: string = 'EUR', levels: ProgressionLevel[] = []): Promise<BetStrategy | null> {
    try {
      const payload = formatStrategyPayload(name, rules, levels);
      const res = await fetch(`${API_BASE}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error('Failed to create strategy in database:', await res.text());
        return null;
      }
      const data = await res.json();
      return normalizeStrategy(data);
    } catch (err) {
      console.error('Network error creating strategy:', err);
      return null;
    }
  },

  async updateStrategy(id: string, name: string, rules: string = 'EUR', levels: ProgressionLevel[]): Promise<BetStrategy | null> {
    try {
      const payload = formatStrategyPayload(name, rules, levels);
      const res = await fetch(`${API_BASE}/strategies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error(`Failed to update strategy ${id}:`, await res.text());
        return null;
      }
      const data = await res.json();
      return normalizeStrategy(data);
    } catch (err) {
      console.error('Network error updating strategy:', err);
      return null;
    }
  },

  async deleteStrategy(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.error('Network error deleting strategy:', err);
      return false;
    }
  },
};
