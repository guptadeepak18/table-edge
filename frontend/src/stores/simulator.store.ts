import { create } from 'zustand';
import { audioService } from '../services/audio.service';
import { strategyService, normalizePlacement } from '../services/strategy.service';
import { type CurrencyConfig, POPULAR_CURRENCIES, DEFAULT_CURRENCY } from '../utils/chipUtils';

export type { CurrencyConfig };
export { POPULAR_CURRENCIES, DEFAULT_CURRENCY };

export type GameRules = 'EUR' | 'USA';
export type WheelRotationMode = 'cw' | 'ccw' | 'alternating';
export type SpinDirection = 'cw' | 'ccw';
export type PocketValue = number | '00';

export const DEFAULT_BANKROLL = 10000;

const getInitialCurrency = (): CurrencyConfig => {
  try {
    const saved = localStorage.getItem('tableedge_currency');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.symbol === 'string' && typeof parsed.code === 'string') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CURRENCY;
};

export interface BetPlacement {
  id: string;
  betType: string;
  coordinateX: number;
  coordinateY: number;
  coveredPockets: PocketValue[];
  amount: number;
  multiplier: number;
  isNeighbour?: boolean;
  frenchSector?: 'tiers' | 'orphelins' | 'voisins' | 'zero';
}

export interface ProgressionLevel {
  levelNumber: number;
  totalWager: number;
  placements: BetPlacement[];
}

export interface BetStrategy {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  levels: ProgressionLevel[];
}

export interface SpinResult {
  id: string;
  pocketNumber: PocketValue;
  color: 'red' | 'black' | 'green';
  timestamp: number;
  totalBet: number;
  totalPayout: number;
  netWin: number;
  resultingBankroll: number;
  rngMethod: string;
  seedHash?: string;
  strategyName?: string;
  hotNumbers?: PocketValue[];
  coldNumbers?: PocketValue[];
  placedBets?: BetPlacement[];
}

export interface SessionDataPoint {
  spinIndex: number;
  cumulativeProfit: number;
  strategyName: string;
  netWin: number;
  totalBet: number;
  totalPayout: number;
  isWin: boolean;
  isLoss: boolean;
  isPush: boolean;
}

interface SimulatorState {
  bankroll: number;
  initialBankroll: number;
  sessionId: string;
  rules: GameRules;
  currency: CurrencyConfig;
  fastMode: boolean;
  usePhysicalWheel: boolean;
  rotationMode: WheelRotationMode;
  currentSpinDirection: SpinDirection;
  selectedChip: number;
  activeBets: BetPlacement[];
  lastBets: BetPlacement[];
  lastBetActionHistory: { betType: string; coveredPockets: PocketValue[]; amount: number }[];
  betActionHistory: { betType: string; coveredPockets: PocketValue[]; amount: number }[];
  savedLevels: ProgressionLevel[];
  currentLevelIndex: number;
  spinHistory: SpinResult[];
  isSpinning: boolean;
  lastSpinResult: SpinResult | null;
  tableFeltColor: string;
  hotNumbers: PocketValue[];
  coldNumbers: PocketValue[];
  historyDisplayCount: number;
  contradictingBetWarning: string | null;

  // Historical Spins from Database table for Statistics
  historicalSpins: SpinResult[];
  fetchHistoricalSpins: (limit?: number) => Promise<void>;

  // Strategy tracking
  currentStrategyName: string;
  setCurrentStrategyName: (name: string) => void;

  // Session Live Stats metrics (Screenshots 3, 4, 5)
  sessionProfit: number;
  pushesCount: number;
  winsCount: number;
  lossesCount: number;
  totalWagered: number;
  sessionProfitHistory: SessionDataPoint[];

  // Actions
  selectChip: (chip: number) => void;
  placeBet: (bet: Omit<BetPlacement, 'id' | 'amount'>) => void;
  placeBatchBets: (bets: Array<{ betType: string; coordinateX?: number; coordinateY?: number; coveredPockets: PocketValue[]; multiplier: number; amount: number; isNeighbour?: boolean; frenchSector?: 'tiers' | 'orphelins' | 'voisins' | 'zero' }>) => void;
  undoLastBet: () => void;
  doubleBets: () => void;
  clearBoard: (refund?: boolean) => void;
  removeBet: (betId: string) => void;
  transferBet: (sourceBetId: string, targetPockets: PocketValue[], targetBetType: string, targetMultiplier: number) => void;
  rebet: () => void;
  setRules: (rules: GameRules) => void;
  setCurrency: (currency: CurrencyConfig) => void;
  setFastMode: (fast: boolean) => void;
  setPhysicalWheel: (enabled: boolean) => void;
  setRotationMode: (mode: WheelRotationMode) => void;
  setFeltColor: (color: string) => void;
  setBankroll: (amount: number) => void;
  setHistoryDisplayCount: (count: number) => void;
  clearContradictingWarning: () => void;
  resetSessionStats: () => void;
  fetchDatabaseHotColdStats: () => Promise<void>;
  
  spinRequestId: number;
  requestSpin: () => void;

  // Strategy and Progression levels
  strategies: BetStrategy[];
  currentStrategyId: string;
  fetchStrategiesFromDb: () => Promise<void>;
  createStrategy: (name: string, description?: string) => Promise<BetStrategy>;
  loadStrategy: (strategyId: string) => void;
  deleteStrategy: (strategyId: string) => void;
  renameStrategy: (strategyId: string, newName: string) => void;
  clearLevel: (levelNumber: number) => void;
  clearAllLevels: () => void;

  // Progression levels actions (Dynamic N-levels)
  addLevel: () => Promise<void>;
  removeLevel: (levelNumber: number) => Promise<void>;
  saveBoardToLevel: (levelNumber: number) => Promise<void>;
  saveBoardAsNewLevel: () => Promise<void>;
  loadBoardFromLevel: (levelNumber: number) => void;
  
  // Spin execution
  triggerSpin: () => Promise<SpinResult | null>;
  setSpinning: (spinning: boolean) => void;
  finalizeSpin: (result: SpinResult) => void;
}

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const EUR_POCKETS: PocketValue[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const CONTRADICTING_PAIRS: Record<string, { opposite: string; label: string }> = {
  outside_red: { opposite: 'outside_black', label: 'RED and BLACK' },
  outside_black: { opposite: 'outside_red', label: 'BLACK and RED' },
  outside_even: { opposite: 'outside_odd', label: 'EVEN and ODD' },
  outside_odd: { opposite: 'outside_even', label: 'ODD and EVEN' },
  outside_low: { opposite: 'outside_high', label: '1-18 (LOW) and 19-36 (HIGH)' },
  outside_high: { opposite: 'outside_low', label: '19-36 (HIGH) and 1-18 (LOW)' },
};
const DOZEN_KEYS = ['dozen_1', 'dozen_2', 'dozen_3'];
const COLUMN_KEYS = ['col_1', 'col_2', 'col_3'];

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  bankroll: 10000,
  initialBankroll: 10000,
  sessionId: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  rules: 'EUR',
  currency: getInitialCurrency(),
  fastMode: false,
  usePhysicalWheel: true,
  rotationMode: 'alternating',
  currentSpinDirection: 'cw',
  selectedChip: 10,
  activeBets: [],
  lastBets: [],
  lastBetActionHistory: [],
  betActionHistory: [],

  // Strategies & Levels (defaults to empty/Freestyle — user must manually select a strategy)
  strategies: [],
  currentStrategyId: '',
  savedLevels: [],
  currentStrategyName: 'Freestyle',
  setCurrentStrategyName: (name: string) => set({ currentStrategyName: name }),

  currentLevelIndex: 0,
  spinHistory: [],
  historicalSpins: [],
  isSpinning: false,
  lastSpinResult: null,
  tableFeltColor: '#0b3d24',
  hotNumbers: [8, 21, 27, 28, 2],
  coldNumbers: [36, 35, 34, 31, 0],
  historyDisplayCount: 20,
  contradictingBetWarning: null,

  sessionProfit: 0,
  pushesCount: 0,
  winsCount: 0,
  lossesCount: 0,
  totalWagered: 0,
  sessionProfitHistory: [
    {
      spinIndex: 0,
      cumulativeProfit: 0,
      strategyName: 'Initial',
      netWin: 0,
      totalBet: 0,
      totalPayout: 0,
      isWin: false,
      isLoss: false,
      isPush: false,
    },
  ],

  spinRequestId: 0,

  setHistoryDisplayCount: (count) => set({ historyDisplayCount: Math.max(1, Math.min(100, count)) }),
  clearContradictingWarning: () => set({ contradictingBetWarning: null }),
  resetSessionStats: () => {
    set({
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      // Reset bankroll fully back to the default starting amount
      bankroll: DEFAULT_BANKROLL,
      initialBankroll: DEFAULT_BANKROLL,
      // Clear all session stats
      sessionProfit: 0,
      pushesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      totalWagered: 0,
      // Clear spin history and last result
      spinHistory: [],
      lastSpinResult: null,
      // Clear the board
      activeBets: [],
      lastBets: [],
      lastBetActionHistory: [],
      betActionHistory: [],
      // Reset chart data
      sessionProfitHistory: [
        {
          spinIndex: 0,
          cumulativeProfit: 0,
          strategyName: 'Initial',
          netWin: 0,
          totalBet: 0,
          totalPayout: 0,
          isWin: false,
          isLoss: false,
          isPush: false,
        },
      ],
    });
  },

  fetchDatabaseHotColdStats: async () => {
    try {
      const { rules } = get();
      const res = await fetch(`/api/simulator/stats/hot-cold?rules=${rules}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hot_numbers && data.cold_numbers) {
          set({
            hotNumbers: data.hot_numbers,
            coldNumbers: data.cold_numbers,
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch database hot/cold stats:", err);
    }
  },

  fetchHistoricalSpins: async (limit = 500) => {
    try {
      const res = await fetch(`/api/simulator/spins?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const parsedSpins: SpinResult[] = data.map((s: any) => ({
            id: s.id,
            pocketNumber: (s.pocket_number === '00' ? '00' : Number(s.pocket_number)) as PocketValue,
            color: s.color,
            timestamp: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
            totalBet: s.total_bet || 0,
            totalPayout: s.total_payout || 0,
            netWin: s.net_win || 0,
            resultingBankroll: s.resulting_bankroll || 10000,
            rngMethod: s.rng_method || 'secrets.randbelow',
            strategyName: s.strategy_name || 'Historical',
          }));
          set({ historicalSpins: parsedSpins });
        }
      }
    } catch (err) {
      console.warn("Could not fetch historical spins:", err);
    }
  },

  requestSpin: () => {
    const { isSpinning, activeBets } = get();
    if (isSpinning) return;
    if (activeBets.length === 0) {
      alert("PLACEMENT EMPTY\nPlace some bets on the board first!");
      return;
    }
    set(state => ({ spinRequestId: state.spinRequestId + 1 }));
  },

  selectChip: (chip) => {
    audioService.playChipClick();
    set({ selectedChip: chip });
  },

  placeBet: (betData) => {
    const { selectedChip, bankroll, activeBets, betActionHistory } = get();
    if (bankroll < selectedChip) {
      alert("Insufficient bankroll!");
      return;
    }

    // 1. Validate Contradicting Bets
    if (CONTRADICTING_PAIRS[betData.betType]) {
      const oppKey = CONTRADICTING_PAIRS[betData.betType].opposite;
      const oppBet = activeBets.find(b => b.betType === oppKey);
      if (oppBet) {
        const warningMsg = `Contradicting Bet: You cannot bet on both ${CONTRADICTING_PAIRS[betData.betType].label} simultaneously!`;
        audioService.playLoss();
        set({ contradictingBetWarning: warningMsg });
        setTimeout(() => {
          if (get().contradictingBetWarning === warningMsg) {
            set({ contradictingBetWarning: null });
          }
        }, 3500);
        return;
      }
    }

    if (DOZEN_KEYS.includes(betData.betType)) {
      const existingDozens = new Set(activeBets.filter(b => DOZEN_KEYS.includes(b.betType)).map(b => b.betType));
      existingDozens.add(betData.betType);
      if (existingDozens.size === 3) {
        const warningMsg = `Contradicting Bet: You cannot bet on all three Dozens simultaneously!`;
        audioService.playLoss();
        set({ contradictingBetWarning: warningMsg });
        setTimeout(() => {
          if (get().contradictingBetWarning === warningMsg) {
            set({ contradictingBetWarning: null });
          }
        }, 3500);
        return;
      }
    }

    if (COLUMN_KEYS.includes(betData.betType)) {
      const existingCols = new Set(activeBets.filter(b => COLUMN_KEYS.includes(b.betType)).map(b => b.betType));
      existingCols.add(betData.betType);
      if (existingCols.size === 3) {
        const warningMsg = `Contradicting Bet: You cannot bet on all three Columns simultaneously!`;
        audioService.playLoss();
        set({ contradictingBetWarning: warningMsg });
        setTimeout(() => {
          if (get().contradictingBetWarning === warningMsg) {
            set({ contradictingBetWarning: null });
          }
        }, 3500);
        return;
      }
    }

    audioService.playChipClick();

    // Check if an existing bet of the same type and covered pockets already exists
    const sortedTarget = [...betData.coveredPockets].map(String).sort().join(',');
    const existingIndex = activeBets.findIndex(
      b => b.betType === betData.betType &&
           [...b.coveredPockets].map(String).sort().join(',') === sortedTarget
    );

    let updatedBets: BetPlacement[];
    if (existingIndex >= 0) {
      updatedBets = activeBets.map((b, idx) =>
        idx === existingIndex ? { ...b, amount: b.amount + selectedChip } : b
      );
    } else {
      const newBet: BetPlacement = {
        id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        betType: betData.betType,
        coordinateX: betData.coordinateX,
        coordinateY: betData.coordinateY,
        coveredPockets: betData.coveredPockets,
        amount: selectedChip,
        multiplier: betData.multiplier,
      };
      updatedBets = [...activeBets, newBet];
    }

    // Push to granular action history for step-by-step undo
    const updatedHistory = [
      ...betActionHistory,
      {
        betType: betData.betType,
        coveredPockets: betData.coveredPockets,
        amount: selectedChip,
      },
    ];

    set({
      activeBets: updatedBets,
      betActionHistory: updatedHistory,
      bankroll: parseFloat((bankroll - selectedChip).toFixed(2)),
    });
  },

  placeBatchBets: (betsToPlace) => {
    const { bankroll, activeBets, betActionHistory } = get();
    const totalCost = betsToPlace.reduce((sum, b) => sum + b.amount, 0);
    if (bankroll < totalCost) {
      alert(`Insufficient bankroll! Required: $${totalCost.toLocaleString()}`);
      return;
    }

    audioService.playChipStack();

    let newBets: BetPlacement[] = JSON.parse(JSON.stringify(activeBets));
    const newActions: Array<{ betType: string; coveredPockets: PocketValue[]; amount: number }> = [];

    for (const bet of betsToPlace) {
      const sortedPockets = [...bet.coveredPockets].map(String).sort().join(',');
      const existingIdx = newBets.findIndex(
        b => b.betType === bet.betType &&
             b.frenchSector === bet.frenchSector &&
             [...b.coveredPockets].map(String).sort().join(',') === sortedPockets
      );

      if (existingIdx >= 0) {
        newBets[existingIdx].amount += bet.amount;
        if (bet.isNeighbour) {
          newBets[existingIdx].isNeighbour = true;
        }
      } else {
        newBets.push({
          id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          betType: bet.betType,
          coordinateX: bet.coordinateX ?? 0,
          coordinateY: bet.coordinateY ?? 0,
          coveredPockets: bet.coveredPockets,
          amount: bet.amount,
          multiplier: bet.multiplier,
          isNeighbour: bet.isNeighbour,
          frenchSector: bet.frenchSector,
        });
      }

      newActions.push({
        betType: bet.betType,
        coveredPockets: bet.coveredPockets,
        amount: bet.amount,
      });
    }

    set({
      activeBets: newBets,
      betActionHistory: [...betActionHistory, ...newActions],
      bankroll: parseFloat((bankroll - totalCost).toFixed(2)),
    });
  },

  undoLastBet: () => {
    const { activeBets, bankroll, betActionHistory } = get();
    if (betActionHistory.length === 0 || activeBets.length === 0) return;

    audioService.playChipClick();

    // Pop the last action
    const lastAction = betActionHistory[betActionHistory.length - 1];
    const updatedHistory = betActionHistory.slice(0, -1);

    const sortedTarget = [...lastAction.coveredPockets].map(String).sort().join(',');
    const targetIdx = activeBets.findIndex(
      b => b.betType === lastAction.betType &&
           [...b.coveredPockets].map(String).sort().join(',') === sortedTarget
    );

    if (targetIdx === -1) {
      set({ betActionHistory: updatedHistory });
      return;
    }

    const targetBet = activeBets[targetIdx];
    const newAmount = targetBet.amount - lastAction.amount;

    let updatedBets: BetPlacement[];
    if (newAmount <= 0) {
      updatedBets = activeBets.filter((_, idx) => idx !== targetIdx);
    } else {
      updatedBets = activeBets.map((b, idx) =>
        idx === targetIdx ? { ...b, amount: newAmount } : b
      );
    }

    set({
      activeBets: updatedBets,
      betActionHistory: updatedHistory,
      bankroll: parseFloat((bankroll + lastAction.amount).toFixed(2)),
    });
  },

  doubleBets: () => {
    const { activeBets, bankroll, betActionHistory } = get();
    const totalCurrentBet = activeBets.reduce((sum, b) => sum + b.amount, 0);
    if (totalCurrentBet === 0) return;
    if (bankroll < totalCurrentBet) {
      alert("Insufficient bankroll to double bets!");
      return;
    }

    audioService.playChipStack();
    const doubledBets = activeBets.map(b => ({ ...b, amount: b.amount * 2 }));

    // Duplicate each bet action currently representing activeBets
    let doubleActions: { betType: string; coveredPockets: PocketValue[]; amount: number }[] = [];
    if (betActionHistory && betActionHistory.length > 0) {
      doubleActions = betActionHistory.map(a => ({ ...a }));
    } else {
      doubleActions = activeBets.map(b => ({
        betType: b.betType,
        coveredPockets: b.coveredPockets,
        amount: b.amount,
      }));
    }

    set({
      activeBets: doubledBets,
      betActionHistory: [...betActionHistory, ...doubleActions],
      bankroll: parseFloat((bankroll - totalCurrentBet).toFixed(2)),
    });
  },

  clearBoard: (refund: boolean = true) => {
    const { activeBets, bankroll } = get();
    if (activeBets.length === 0) return;

    audioService.playChipSweep();
    const refunded = activeBets.reduce((sum, b) => sum + b.amount, 0);
    set({
      activeBets: [],
      betActionHistory: [],
      bankroll: refund ? parseFloat((bankroll + refunded).toFixed(2)) : bankroll,
    });
  },

  removeBet: (betId: string) => {
    const { activeBets, bankroll, betActionHistory } = get();
    const target = activeBets.find(b => b.id === betId);
    if (!target) return;
    audioService.playChipClick();
    const targetKey = [...target.coveredPockets].map(String).sort().join(',');
    const updatedHistory = betActionHistory.filter(a =>
      !(a.betType === target.betType && [...a.coveredPockets].map(String).sort().join(',') === targetKey)
    );
    set({
      activeBets: activeBets.filter(b => b.id !== betId),
      betActionHistory: updatedHistory,
      bankroll: parseFloat((bankroll + target.amount).toFixed(2)),
    });
  },

  transferBet: (sourceBetId: string, targetPockets: PocketValue[], targetBetType: string, targetMultiplier: number) => {
    const { activeBets, betActionHistory } = get();
    const source = activeBets.find(b => b.id === sourceBetId);
    if (!source) return;
    // Prevent drop onto same zone
    const sourceKey = [...source.coveredPockets].map(String).sort().join(',');
    const targetKey = [...targetPockets].map(String).sort().join(',');
    if (source.betType === targetBetType && sourceKey === targetKey) return;

    const existingTarget = activeBets.find(b =>
      b.betType === targetBetType &&
      [...b.coveredPockets].map(String).sort().join(',') === targetKey
    );
    let updatedBets: typeof activeBets;
    if (existingTarget) {
      updatedBets = activeBets
        .filter(b => b.id !== sourceBetId)
        .map(b => b.id === existingTarget.id
          ? { ...b, amount: parseFloat((b.amount + source.amount).toFixed(2)) }
          : b
        );
    } else {
      updatedBets = activeBets
        .filter(b => b.id !== sourceBetId)
        .concat({
          ...source,
          id: `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          betType: targetBetType,
          coveredPockets: targetPockets,
          multiplier: targetMultiplier,
          coordinateX: 0,
          coordinateY: 0,
        });
    }
    const updatedHistory = betActionHistory.map(a =>
      (a.betType === source.betType && [...a.coveredPockets].map(String).sort().join(',') === sourceKey)
        ? { ...a, betType: targetBetType, coveredPockets: targetPockets }
        : a
    );
    audioService.playChipClick();
    // bankroll unchanged — just moving the bet
    set({ activeBets: updatedBets, betActionHistory: updatedHistory });
  },

  rebet: () => {
    const { lastBets, lastBetActionHistory, bankroll, activeBets } = get();
    if (lastBets.length === 0) return;

    const totalRebet = lastBets.reduce((sum, b) => sum + b.amount, 0);
    if (bankroll < totalRebet) {
      alert("Insufficient bankroll to rebet!");
      return;
    }

    audioService.playChipStack();
    // Clear current board first if any
    const refunded = activeBets.reduce((sum, b) => sum + b.amount, 0);

    // Restore exact granular action history from last spin if available and matching
    let restoredActionHistory: { betType: string; coveredPockets: PocketValue[]; amount: number }[] = [];
    if (lastBetActionHistory && lastBetActionHistory.length > 0) {
      const historyTotal = lastBetActionHistory.reduce((sum, a) => sum + a.amount, 0);
      if (Math.abs(historyTotal - totalRebet) < 0.01) {
        restoredActionHistory = lastBetActionHistory.map(a => ({ ...a }));
      }
    }

    if (restoredActionHistory.length === 0) {
      restoredActionHistory = lastBets.map(b => ({
        betType: b.betType,
        coveredPockets: b.coveredPockets,
        amount: b.amount,
      }));
    }

    set({
      activeBets: JSON.parse(JSON.stringify(lastBets)),
      betActionHistory: restoredActionHistory,
      bankroll: parseFloat((bankroll + refunded - totalRebet).toFixed(2)),
    });
  },

  setRules: (rules) => {
    set({ rules, activeBets: [] });
    get().fetchDatabaseHotColdStats();
  },
  setCurrency: (currency) => {
    try {
      localStorage.setItem('tableedge_currency', JSON.stringify(currency));
    } catch {
      // ignore
    }
    set({ currency });
  },
  setFastMode: (fastMode) => set({ fastMode }),
  setPhysicalWheel: (usePhysicalWheel) => set({ usePhysicalWheel }),
  setRotationMode: (rotationMode) => set({ rotationMode }),
  setFeltColor: (tableFeltColor) => set({ tableFeltColor }),
  setBankroll: (amount) => set({
    bankroll: amount,
    initialBankroll: amount,
    sessionProfit: 0,
    sessionProfitHistory: [
      {
        spinIndex: 0,
        cumulativeProfit: 0,
        strategyName: 'Initial',
        netWin: 0,
        totalBet: 0,
        totalPayout: 0,
        isWin: false,
        isLoss: false,
        isPush: false,
      },
    ],
  }),
  setSpinning: (isSpinning) => set({ isSpinning }),

  // Strategy & Levels Database Synchronization & Management
  fetchStrategiesFromDb: async () => {
    try {
      const dbStrategies = await strategyService.fetchStrategies();
      const { currentStrategyId } = get();
      if (dbStrategies && dbStrategies.length > 0) {
        // ONLY retain strategy if user has manually chosen one that still exists in DB
        const stillValid = currentStrategyId ? dbStrategies.find(s => s.id === currentStrategyId) : null;
        if (stillValid) {
          set({
            strategies: dbStrategies,
            currentStrategyId: stillValid.id,
            currentStrategyName: stillValid.name,
            savedLevels: stillValid.levels,
          });
        } else {
          // By default do NOT load any strategy!
          set({
            strategies: dbStrategies,
            currentStrategyId: '',
            currentStrategyName: 'Freestyle',
            savedLevels: [],
          });
        }
      } else {
        set({
          strategies: [],
          currentStrategyId: '',
          currentStrategyName: 'Freestyle',
          savedLevels: [],
        });
      }
    } catch (err) {
      console.warn("Could not fetch strategies from DB:", err);
    }
  },

  createStrategy: async (name: string, description?: string) => {
    const { strategies, rules, activeBets } = get();
    const finalName = name.trim() || `Strategy ${strategies.length + 1}`;
    
    // Start with ONLY 1 level: if active bets exist on the felt, save them as Level 1; otherwise start with an empty Level 1
    const initialPlacements = activeBets.length > 0 ? JSON.parse(JSON.stringify(activeBets)) : [];
    const totalWager = initialPlacements.reduce((sum: number, b: any) => sum + b.amount, 0);
    const initialLevels: ProgressionLevel[] = [{
      levelNumber: 1,
      totalWager,
      placements: initialPlacements,
    }];

    // Persist to database
    const saved = await strategyService.createStrategy(finalName, rules, initialLevels);
    const newStrat: BetStrategy = saved || {
      id: `strat-${Date.now()}`,
      name: finalName,
      description: description || '',
      createdAt: Date.now(),
      levels: initialLevels,
    };

    const updated = [...strategies, newStrat];
    set({
      strategies: updated,
      currentStrategyId: newStrat.id,
      currentStrategyName: newStrat.name,
      savedLevels: newStrat.levels,
    });
    return newStrat;
  },

  loadStrategy: (strategyId: string) => {
    if (!strategyId || strategyId === 'freestyle') {
      // Manual selection of Freestyle / None
      set({
        currentStrategyId: '',
        currentStrategyName: 'Freestyle',
        savedLevels: [],
      });
      return;
    }
    const { strategies } = get();
    const strat = strategies.find(s => s.id === strategyId);
    if (!strat) return;
    set({
      currentStrategyId: strat.id,
      currentStrategyName: strat.name,
      savedLevels: strat.levels,
    });
  },

  deleteStrategy: (strategyId: string) => {
    const { strategies, currentStrategyId } = get();
    // Persist deletion to DB
    strategyService.deleteStrategy(strategyId).catch(err => console.error("Error deleting strategy:", err));

    const remaining = strategies.filter(s => s.id !== strategyId);
    if (currentStrategyId === strategyId) {
      // Revert to Freestyle
      set({
        strategies: remaining,
        currentStrategyId: '',
        currentStrategyName: 'Freestyle',
        savedLevels: [],
      });
    } else {
      set({
        strategies: remaining,
      });
    }
  },

  renameStrategy: (strategyId: string, newName: string) => {
    const { strategies, currentStrategyId, rules } = get();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updated = strategies.map(s => s.id === strategyId ? { ...s, name: trimmed } : s);
    const currentStrat = updated.find(s => s.id === strategyId);
    if (currentStrat) {
      strategyService.updateStrategy(strategyId, trimmed, rules, currentStrat.levels).catch(err => console.error("Error updating strategy name:", err));
    }
    set({
      strategies: updated,
      currentStrategyName: currentStrat && currentStrat.id === currentStrategyId ? currentStrat.name : get().currentStrategyName,
    });
  },

  // Progression Levels within Current Strategy
  addLevel: async () => {
    const { strategies, currentStrategyId, rules } = get();
    let targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) {
      targetStrat = await get().createStrategy('My Strategy');
    }

    const nextNum = targetStrat.levels.length + 1;
    const newLevel: ProgressionLevel = {
      levelNumber: nextNum,
      totalWager: 0,
      placements: [],
    };
    const updatedLevels = [...targetStrat.levels, newLevel];
    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat!.id ? { ...strat, levels: updatedLevels } : strat
    );

    set({
      strategies: updatedStrategies,
      currentStrategyId: targetStrat.id,
      savedLevels: updatedLevels,
    });

    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, updatedLevels);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error adding level in DB:", err);
    }
  },

  removeLevel: async (levelNumber: number) => {
    const { strategies, currentStrategyId, rules } = get();
    const targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) return;

    // Filter out the exact level clicked, renumber remaining contiguously (1, 2, 3...)
    const filtered = targetStrat.levels
      .filter(l => l.levelNumber !== levelNumber)
      .map((l, idx) => ({ ...l, levelNumber: idx + 1 }));

    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat.id ? { ...strat, levels: filtered } : strat
    );

    set({
      strategies: updatedStrategies,
      savedLevels: filtered,
    });

    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, filtered);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error removing level in DB:", err);
    }
  },

  saveBoardToLevel: async (levelNumber: number) => {
    const { activeBets, strategies, currentStrategyId, rules } = get();
    let targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) {
      await get().createStrategy('My Strategy');
      return;
    }

    const totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
    audioService.playChipStack();

    const levelExists = targetStrat.levels.some(l => l.levelNumber === levelNumber);
    let updatedLevels: ProgressionLevel[];
    if (levelExists) {
      updatedLevels = targetStrat.levels.map(l =>
        l.levelNumber === levelNumber
          ? { ...l, totalWager, placements: JSON.parse(JSON.stringify(activeBets)) }
          : l
      );
    } else {
      updatedLevels = [
        ...targetStrat.levels,
        { levelNumber, totalWager, placements: JSON.parse(JSON.stringify(activeBets)) }
      ].sort((a, b) => a.levelNumber - b.levelNumber)
       .map((l, idx) => ({ ...l, levelNumber: idx + 1 }));
    }

    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat!.id ? { ...strat, levels: updatedLevels } : strat
    );

    set({
      strategies: updatedStrategies,
      currentStrategyId: targetStrat.id,
      savedLevels: updatedLevels,
      currentStrategyName: targetStrat.name,
    });

    // Persist to database immediately
    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, updatedLevels);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error saving level to DB:", err);
    }
  },

  saveBoardAsNewLevel: async () => {
    const { activeBets, strategies, currentStrategyId, rules } = get();
    let targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) {
      await get().createStrategy('My Strategy');
      return;
    }

    const nextNum = targetStrat.levels.length + 1;
    const totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
    audioService.playChipStack();

    const newLevel: ProgressionLevel = {
      levelNumber: nextNum,
      totalWager,
      placements: JSON.parse(JSON.stringify(activeBets)),
    };
    const updatedLevels = [...targetStrat.levels, newLevel];
    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat!.id ? { ...strat, levels: updatedLevels } : strat
    );

    set({
      strategies: updatedStrategies,
      currentStrategyId: targetStrat.id,
      savedLevels: updatedLevels,
      currentStrategyName: targetStrat.name,
    });

    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, updatedLevels);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error saving new level to DB:", err);
    }
  },

  loadBoardFromLevel: (levelNumber: number) => {
    const { strategies, currentStrategyId, bankroll, activeBets } = get();
    const currentStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!currentStrat) return;
    const target = currentStrat.levels.find(l => l.levelNumber === levelNumber);
    if (!target || target.placements.length === 0) return;

    // Normalize each placement to guarantee proper camelCase and valid fields
    const normalizedPlacements = target.placements.map(normalizePlacement);
    const additionalWager = normalizedPlacements.reduce((sum, p) => sum + p.amount, 0);

    if (bankroll < additionalWager) {
      alert("Insufficient bankroll to place this level's bets!");
      return;
    }

    // Additive: Add level's bets to existing chips on the felt (do not replace)
    const newBets: BetPlacement[] = JSON.parse(JSON.stringify(activeBets));

    for (const placement of normalizedPlacements) {
      const targetKey = [...placement.coveredPockets].map(String).sort().join(',');
      const existingIndex = newBets.findIndex(
        b => b.betType === placement.betType && [...b.coveredPockets].map(String).sort().join(',') === targetKey
      );

      if (existingIndex >= 0) {
        newBets[existingIndex].amount += placement.amount;
      } else {
        newBets.push({
          ...placement,
          id: `bet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        });
      }
    }

    const levelActions = normalizedPlacements.map(p => ({
      betType: p.betType,
      coveredPockets: p.coveredPockets,
      amount: p.amount,
    }));

    audioService.playChipStack();
    set({
      activeBets: newBets,
      betActionHistory: [...get().betActionHistory, ...levelActions],
      bankroll: parseFloat((bankroll - additionalWager).toFixed(2)),
      currentStrategyName: currentStrat.name,
    });
  },

  clearLevel: async (levelNumber: number) => {
    const { strategies, currentStrategyId, rules } = get();
    const targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) return;

    const updatedLevels = targetStrat.levels.map(l =>
      l.levelNumber === levelNumber ? { ...l, totalWager: 0, placements: [] } : l
    );
    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat.id ? { ...strat, levels: updatedLevels } : strat
    );

    set({
      strategies: updatedStrategies,
      savedLevels: updatedLevels,
    });

    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, updatedLevels);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error clearing level in DB:", err);
    }
  },

  clearAllLevels: async () => {
    const { strategies, currentStrategyId, rules } = get();
    const targetStrat = strategies.find(s => s.id === currentStrategyId) || strategies[0];
    if (!targetStrat) return;

    const updatedLevels = targetStrat.levels.map(l => ({ ...l, totalWager: 0, placements: [] }));
    const updatedStrategies = strategies.map(strat =>
      strat.id === targetStrat.id ? { ...strat, levels: updatedLevels } : strat
    );

    set({
      strategies: updatedStrategies,
      savedLevels: updatedLevels,
    });

    try {
      const saved = await strategyService.updateStrategy(targetStrat.id, targetStrat.name, rules, updatedLevels);
      if (saved) {
        set({
          strategies: get().strategies.map(s => s.id === saved.id ? saved : s),
          savedLevels: saved.levels,
        });
      }
    } catch (err) {
      console.error("Error clearing levels in DB:", err);
    }
  },


  triggerSpin: async () => {
    const {
      activeBets,
      rules,
      isSpinning,
      rotationMode,
      currentSpinDirection,
      sessionId,
      currentStrategyId,
      currentStrategyName,
      currentLevelIndex,
      bankroll,
    } = get();
    if (isSpinning) return null;
    if (activeBets.length === 0) {
      alert("PLACEMENT EMPTY\nPlace some bets on the board first!");
      return null;
    }

    set({ isSpinning: true });

    // Determine spin direction
    let spinDir: SpinDirection = 'cw';
    if (rotationMode === 'cw') spinDir = 'cw';
    else if (rotationMode === 'ccw') spinDir = 'ccw';
    else if (rotationMode === 'alternating') {
      spinDir = currentSpinDirection === 'cw' ? 'ccw' : 'cw';
    }

    const rawStratName = currentStrategyId && currentStrategyName ? currentStrategyName : 'Freestyle';
    const stratName = rawStratName.replace(/\s*\((?:L|Level\s*)\d+\)$/i, '').trim() || 'Freestyle';
    const levelNum = currentLevelIndex + 1;

    // ── 1. Generate result INSTANTLY client-side using Web Crypto ────────────
    const maxPockets = rules === 'USA' ? 38 : 37;
    // Use rejection sampling to avoid modulo bias
    let rand: number;
    do {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= Math.floor(0xFFFFFFFF / maxPockets) * maxPockets);
    rand = rand % maxPockets;

    const pocket: PocketValue = rules === 'USA' && rand === 37 ? '00' : rand;
    const color = pocket === 0 || pocket === '00' ? 'green' : (RED_SET.has(Number(pocket)) ? 'red' : 'black');

    // Client-side payout calculation
    let payout = 0;
    for (const b of activeBets) {
      if (b.coveredPockets.some(p => String(p) === String(pocket))) {
        payout += b.amount * (b.multiplier + 1);
      }
    }
    const totalBet = activeBets.reduce((s, b) => s + b.amount, 0);
    const spinId = `spin-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const spinResult: SpinResult = {
      id: spinId,
      pocketNumber: pocket,
      color,
      timestamp: Date.now(),
      totalBet,
      totalPayout: payout,
      netWin: payout - totalBet,
      resultingBankroll: bankroll + payout,
      rngMethod: 'client.webCrypto',
      strategyName: stratName,
      placedBets: JSON.parse(JSON.stringify(activeBets)),
    };

    set({ currentSpinDirection: spinDir });

    // ── 2. Persist to DB in background (non-blocking) ────────────────────────
    (async () => {
      try {
        const res = await fetch('/api/simulator/spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules,
            session_id: sessionId,
            strategy_name: stratName,
            level_number: levelNum,
            client_bankroll: bankroll,
            pocket_override: String(pocket), // tell server to use our number
            bets: activeBets.map(b => ({
              id: b.id,
              bet_type: b.betType,
              coordinate_x: b.coordinateX,
              coordinateY: b.coordinateY,
              covered_pockets: b.coveredPockets,
              amount: b.amount,
              multiplier: b.multiplier,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // Sync hot/cold numbers from DB result
          if (data.hot_numbers?.length > 0) {
            set({ hotNumbers: data.hot_numbers, coldNumbers: data.cold_numbers });
          }
        }
      } catch {
        // Silently ignore — result is already shown client-side
      }
    })();

    return spinResult;
  },

  finalizeSpin: (result: SpinResult) => {
    const {
      spinHistory,
      activeBets,
      winsCount,
      lossesCount,
      pushesCount,
      totalWagered,
      sessionProfitHistory,
      currentStrategyId,
      currentStrategyName,
      hotNumbers: currentHotNumbers,
      coldNumbers: currentColdNumbers,
    } = get();

    if (result.netWin > 0) {
      audioService.playWinPayout();
    } else if (result.netWin < 0) {
      audioService.playLoss();
    }

    const rawStratName = result.strategyName || (currentStrategyId && currentStrategyName ? currentStrategyName : 'Freestyle');
    const stratName = rawStratName.replace(/\s*\((?:L|Level\s*)\d+\)$/i, '').trim() || 'Freestyle';
    const resultWithStrategy: SpinResult = {
      ...result,
      strategyName: stratName,
      placedBets: result.placedBets || JSON.parse(JSON.stringify(activeBets)),
    };

    const updatedHistory = [resultWithStrategy, ...spinHistory].slice(0, 100);

    const isPush = result.totalBet > 0 && result.totalPayout === result.totalBet;
    const isWin = result.netWin > 0;
    const isLoss = result.netWin < 0;

    const prevProfit = sessionProfitHistory.length > 0
      ? sessionProfitHistory[sessionProfitHistory.length - 1].cumulativeProfit
      : 0;
    const newCumulative = prevProfit + result.netWin;

    const newPoint: SessionDataPoint = {
      spinIndex: sessionProfitHistory.length,
      cumulativeProfit: newCumulative,
      strategyName: stratName,
      netWin: result.netWin,
      totalBet: result.totalBet,
      totalPayout: result.totalPayout,
      isWin,
      isLoss,
      isPush,
    };
    const newProfitHistory: SessionDataPoint[] = [...sessionProfitHistory, newPoint];
    
    // Determine hot and cold numbers (prioritize cross-session database stats)
    let finalHot = (result.hotNumbers && result.hotNumbers.length > 0) ? result.hotNumbers : currentHotNumbers;
    let finalCold = (result.coldNumbers && result.coldNumbers.length > 0) ? result.coldNumbers : currentColdNumbers;

    if (!finalHot || finalHot.length === 0) {
      const counts: Record<string, number> = {};
      for (const s of updatedHistory) {
        counts[String(s.pocketNumber)] = (counts[String(s.pocketNumber)] || 0) + 1;
      }
      const sorted = [...EUR_POCKETS].sort((a, b) => (counts[String(b)] || 0) - (counts[String(a)] || 0));
      finalHot = sorted.slice(0, 5);
      finalCold = sorted.slice(-5);
    }

    set({
      bankroll: result.resultingBankroll,
      lastBets: [...activeBets],
      lastBetActionHistory: [...get().betActionHistory],
      betActionHistory: [],
      spinHistory: updatedHistory,
      historicalSpins: [resultWithStrategy, ...(get().historicalSpins || [])],
      lastSpinResult: resultWithStrategy,
      isSpinning: false,
      hotNumbers: finalHot,
      coldNumbers: finalCold,
      winsCount: isWin ? winsCount + 1 : winsCount,
      lossesCount: isLoss ? lossesCount + 1 : lossesCount,
      pushesCount: isPush ? pushesCount + 1 : pushesCount,
      totalWagered: totalWagered + result.totalBet,
      sessionProfit: newCumulative,
      sessionProfitHistory: newProfitHistory,
    });
  },
}));
