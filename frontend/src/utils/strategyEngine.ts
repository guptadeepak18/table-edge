import type { ProgressionLevel, GameRules } from '../stores/simulator.store';

export type TriggerType =
  | 'total_loss'
  | 'partial_loss'
  | 'any_loss'
  | 'push'
  | 'partial_win'
  | 'max_win'
  | 'any_win'
  | 'consecutive_losses'
  | 'consecutive_wins'
  | 'consecutive_pushes'
  | 'consecutive_non_wins'
  | 'new_peak'
  | 'profit_loss'
  | 'drawdown_gte'
  | 'drawdown_percent_gte'
  | 'bankroll_remaining_lte'
  | 'session_roi_gte'
  | 'level_reached'
  | 'level_at_least'
  | 'spin_count_reached'
  | 'bet_size_gte'
  | (string & {});

export type ActionType =
  | 'increase_level'
  | 'decrease_level'
  | 'goto_level'
  | 'keep_level'
  | 'reset_to_start'
  | 'revert_to_level'
  | 'increase_multiplier'   // additive: currentMultiplier += actionValue
  | 'decrease_multiplier'   // additive: currentMultiplier = max(1, currentMultiplier - actionValue)
  | 'multiply_by'           // geometric: currentMultiplier *= multiplier
  | 'set_multiplier'        // direct: currentMultiplier = multiplier
  | 'double_multiplier'     // 2.0x
  | 'triple_multiplier'     // 3.0x
  | 'half_multiplier'       // 0.5x
  | 'reset_multiplier'      // reset multiplier to 1.0x while staying on current level
  | 'stop_simulation'       // halt session early
  | 'reset_streak_counters' // reset streak counters only
  | (string & {});

export type ComparisonType =
  | 'session_profit_gte'
  | 'session_loss_gte'
  | 'spin_profit_gte'
  | 'spin_loss_gte'
  | 'session_profit_incremental' // auto-advances target by thresholdIncrement each time hit
  | 'peak_profit_giveback'       // profit dropped by $X from its session high
  | 'spin_profit_pct_wager'      // single spin payout >= N*wager
  | (string & {});

export interface StrategyCondition {
  id: string;
  trigger: TriggerType;
  triggerCount: number; // e.g. every 1, 2, 3 occurrences
  comparison?: ComparisonType;
  thresholdAmount?: number;
  thresholdIncrement?: number; // for session_profit_incremental: target advances by this each hit
  action: ActionType;
  actionValue: number; // e.g. 1 for +1/-1 level, or level number for goto_level
  multiplier?: number; // e.g. 1.0, 1.5, 2.0 (scales bet for selected level)
  multiplierMode?: 'fixed' | 'compound'; // fixed (Level × M) or compound (stacking M on streak)
  reason?: string; // Optional rationale (used by AI advisor / NL generator)
}

export interface LevelStats {
  levelNumber: number;
  wager: number;
  timesVisited: number;
  spinsCount: number;
  spinsPercent: number;
  totalWagered: number;
  maxWins: number;
  partialWins: number;
  totalLosses: number;
  partialLosses: number;
  pushes: number;
  winRate: number;
  netProfit: number;
  status: 'Profit Driver' | 'High Bleed' | 'Drawdown Driver' | 'Neutral';
}

export interface AISuggestion {
  title: string;
  diagnosis: string;
  keyObservations: string[];
  reasoning: string;
  suggestedConditions: StrategyCondition[];
  predictedImpact: string;
  conditionReasons?: Record<string, string>;
  archetype?: string;
}

export interface ConditionTriggerStat {
  conditionId: string;
  ruleNumber: number;
  triggerDesc: string;
  actionDesc: string;
  triggerCount: number;
  triggerPercent: number;
}

export interface BacktestHistoryPoint {
  spin: number;
  balance: number;
  level: number;
  multiplier: number;
  outcome: 'initial' | 'total_loss' | 'partial_loss' | 'push' | 'partial_win' | 'max_win';
  pocket?: number | string;
  netWin: number;
  wager: number;
  payout: number;
  cumulativeProfit: number;
  conditionApplied?: string;
  actionTaken?: string;
  nextLevel: number;
  nextMultiplier: number;
}

export interface SessionRecord {
  sessionIndex: number;
  completedSpins: number;
  stoppedEarly: boolean;
  stopReason?: string;
  initialBankroll: number;
  finalBankroll: number;
  netProfit: number;
  roiPercent: number;
  peakBankroll: number;
  lowestBankroll: number;
  maxDrawdown: number;
  totalWins: number;
  maxWins?: number;
  partialWins?: number;
  totalLosses: number;
  partialLosses?: number;
  pushes: number;
  longestWinStreak?: number;
  longestLossStreak?: number;
  totalWagered?: number;
  maxBetSize?: number;
  balanceTrajectory: number[];
  history?: BacktestHistoryPoint[];
}

export interface AdvancedBacktestConfig {
  initialBankroll: number;
  totalSpins: number;
  totalSessions?: number;
  rules: GameRules;
  levels: ProgressionLevel[];
  stopLoss?: number;
  targetProfit?: number;
  conditions: StrategyCondition[];
}

export interface AdvancedBacktestResult {
  initialBankroll: number;
  finalBankroll: number;
  netProfit: number;
  roiPercent: number;
  totalSpins: number;
  completedSpins: number;
  totalSessions: number;
  sessionsWon: number;
  sessionsLost: number;
  sessionsBreakeven: number;
  sessionWinRate: number;
  targetProfitHits: number;
  targetProfitHitRate: number;
  stopLossHits: number;
  stopLossHitRate: number;
  bustCount: number;
  bustRate: number;
  avgProfitPerSession: number;
  medianProfitPerSession: number;
  bestSessionNet: number;
  worstSessionNet: number;
  avgSpinsPerSession: number;
  sessions: SessionRecord[];
  stoppedEarly: boolean;
  stopReason?: string;
  peakBankroll: number;
  lowestBankroll: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  totalWins: number;
  maxWins: number;
  partialWins: number;
  totalLosses: number;
  partialLosses: number;
  pushes: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  expectancyRatio: number;
  expectancyPerSpin: number;
  profitFactor: number;
  longestWinStreak: number;
  longestLossStreak: number;
  totalWagered: number;
  avgBetSize: number;
  maxBetSize: number;
  recoveryFactor: number;
  sharpeRatio: number;
  conditionStats: ConditionTriggerStat[];
  history: BacktestHistoryPoint[];
  levelStats: LevelStats[];
  aiSuggestions: AISuggestion;
}

export function formatTriggerDesc(c: StrategyCondition): string {
  switch (c.trigger) {
    case 'total_loss':
      return `Total Loss (every ${c.triggerCount || 1})`;
    case 'partial_loss':
      return `Partial Loss (every ${c.triggerCount || 1})`;
    case 'any_loss':
      return `Any Loss (every ${c.triggerCount || 1})`;
    case 'push':
      return `Push / Break-Even (every ${c.triggerCount || 1})`;
    case 'partial_win':
      return `Partial Win (every ${c.triggerCount || 1})`;
    case 'max_win':
      return `Max Win (every ${c.triggerCount || 1})`;
    case 'any_win':
      return `Any Win (every ${c.triggerCount || 1})`;
    case 'consecutive_losses':
      return `${c.triggerCount || 2} Consecutive Losses`;
    case 'consecutive_wins':
      return `${c.triggerCount || 2} Consecutive Wins`;
    case 'consecutive_pushes':
      return `${c.triggerCount || 2} Consecutive Pushes`;
    case 'consecutive_non_wins':
      return `${c.triggerCount || 2} Consecutive Non-Wins`;
    case 'new_peak':
      return `New Peak Balance${(c.triggerCount || 1) > 1 ? ` (every ${c.triggerCount})` : ''}`;
    case 'profit_loss':
      if (c.comparison === 'session_profit_incremental') {
        return `Sess Profit (Inc: $${c.thresholdAmount || 0} +$${c.thresholdIncrement || c.thresholdAmount || 0})`;
      } else if (c.comparison === 'session_profit_gte') {
        return `Session Profit ≥ $${c.thresholdAmount || 0}`;
      } else if (c.comparison === 'session_loss_gte') {
        return `Session Loss ≥ $${c.thresholdAmount || 0}`;
      } else if (c.comparison === 'spin_profit_gte') {
        return `Spin Profit ≥ $${c.thresholdAmount || 0}`;
      } else if (c.comparison === 'spin_loss_gte') {
        return `Spin Loss ≥ $${c.thresholdAmount || 0}`;
      } else if (c.comparison === 'peak_profit_giveback') {
        return `Peak Profit Giveback ≥ $${c.thresholdAmount || 0}`;
      } else if (c.comparison === 'spin_profit_pct_wager') {
        return `Spin Payout ≥ ${c.thresholdAmount || 2}× Wager`;
      }
      return 'Profit/Loss';
    case 'drawdown_gte':
      return `Drawdown ≥ $${c.thresholdAmount || 0}`;
    case 'drawdown_percent_gte':
      return `Drawdown ≥ ${c.thresholdAmount || 20}%`;
    case 'bankroll_remaining_lte':
      return `Bankroll Floor ≤ $${c.thresholdAmount || 0}`;
    case 'session_roi_gte':
      return `Session ROI ≥ +${c.thresholdAmount || 25}%`;
    case 'level_reached':
      return `Reached Level L${c.actionValue || c.thresholdAmount || 1}`;
    case 'level_at_least':
      return `At Level ≥ L${c.actionValue || c.thresholdAmount || 2}`;
    case 'spin_count_reached':
      return `Spin #${c.thresholdAmount || c.triggerCount || 50} Reached`;
    case 'bet_size_gte':
      return `Wager Size ≥ $${c.thresholdAmount || 100}`;
    default:
      return String(c.trigger).replace(/_/g, ' ');
  }
}

export const STANDARD_ROULETTE_PAYOUTS: Record<string, number> = {
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

export interface LevelOutcomeBreakdown {
  levelNumber: number;
  totalWager: number;
  maxPayout: number;
  hasPartialWins: boolean;
  hasPartialLosses: boolean;
  isUniformPayout: boolean;
  coverageType: 'single_bet' | 'tiered' | 'partial_coverage' | 'all_win';
  numPlacements: number;
  maxWinPockets: (number | string)[];
  maxWinPayout: number;
  maxWinNet: number;
  partialWinPockets: (number | string)[];
  partialWinMinNet: number;
  partialWinMaxNet: number;
  pushPockets: (number | string)[];
  partialLossPockets: (number | string)[];
  partialLossMinNet: number;
  partialLossMaxNet: number;
  totalLossPockets: (number | string)[];
  pocketPayouts: Record<number | string, number>;
}

export function inspectLevelOutcomes(level: ProgressionLevel, rules: GameRules): LevelOutcomeBreakdown {
  const maxPocket = rules === 'USA' ? 38 : 37;
  const totalWager = Number(level.totalWager) || level.placements.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const pocketsPayoutMap: Record<number, number> = {};
  const pocketsHitCountMap: Record<number, number> = {};

  for (let p = 0; p < maxPocket; p++) {
    let pocketPayout = 0;
    let hitCount = 0;
    for (const bet of level.placements) {
      const defaultMult = STANDARD_ROULETTE_PAYOUTS[bet.betType] || 1.0;
      const mult = defaultMult > 1 ? defaultMult : (bet.multiplier > 0 ? bet.multiplier : defaultMult);
      const winReturn = bet.amount * (mult + 1);

      for (const covered of bet.coveredPockets) {
        const cIdx = rules === 'USA' && String(covered) === '00' ? 37 : Number(covered);
        if (cIdx === p) {
          pocketPayout += winReturn;
          hitCount++;
          break;
        }
      }
    }
    pocketsPayoutMap[p] = pocketPayout;
    pocketsHitCountMap[p] = hitCount;
  }

  const allPayouts = Object.values(pocketsPayoutMap);
  const maxPayout = allPayouts.length > 0 ? Math.max(...allPayouts) : 0;
  const winningPayouts = allPayouts.filter((p) => p > totalWager);
  const minWinPayout = winningPayouts.length > 0 ? Math.min(...winningPayouts) : 0;
  const hasDistinctWinningTiers = (maxPayout - minWinPayout) > 0.01;
  const numPlacements = level.placements.length;

  const maxWinPockets: (number | string)[] = [];
  const partialWinPockets: (number | string)[] = [];
  const pushPockets: (number | string)[] = [];
  const partialLossPockets: (number | string)[] = [];
  const totalLossPockets: (number | string)[] = [];
  const pocketPayouts: Record<number | string, number> = {};

  let partialWinMinNet = Infinity;
  let partialWinMaxNet = -Infinity;
  let partialLossMinNet = Infinity;
  let partialLossMaxNet = -Infinity;

  for (let p = 0; p < maxPocket; p++) {
    const pName = rules === 'USA' && p === 37 ? '00' : p;
    const payout = pocketsPayoutMap[p] || 0;
    pocketPayouts[pName] = payout;
    const net = payout - totalWager;

    if (payout === 0) {
      totalLossPockets.push(pName);
    } else if (payout < totalWager) {
      partialLossPockets.push(pName);
      if (net < partialLossMinNet) partialLossMinNet = net;
      if (net > partialLossMaxNet) partialLossMaxNet = net;
    } else if (Math.abs(payout - totalWager) < 0.001) {
      pushPockets.push(pName);
    } else if (payout >= maxPayout - 0.01 && maxPayout > totalWager) {
      // Hit top payout tier achievable on this strategy layout
      maxWinPockets.push(pName);
    } else {
      // Net profit, but below maximum payout tier (e.g. hedge hit lower payout tier)
      partialWinPockets.push(pName);
      if (net < partialWinMinNet) partialWinMinNet = net;
      if (net > partialWinMaxNet) partialWinMaxNet = net;
    }
  }

  let coverageType: 'single_bet' | 'tiered' | 'partial_coverage' | 'all_win';
  if (numPlacements <= 1) {
    coverageType = 'single_bet';
  } else if (maxWinPockets.length > 0 && partialWinPockets.length > 0) {
    coverageType = 'tiered';
  } else {
    coverageType = 'all_win';
  }

  const isUniformPayout = !hasDistinctWinningTiers && winningPayouts.length > 0;

  return {
    levelNumber: level.levelNumber,
    totalWager,
    maxPayout,
    hasPartialWins: partialWinPockets.length > 0,
    hasPartialLosses: partialLossPockets.length > 0,
    isUniformPayout,
    coverageType,
    numPlacements,
    maxWinPockets,
    maxWinPayout: maxPayout,
    maxWinNet: maxPayout - totalWager,
    partialWinPockets,
    partialWinMinNet: partialWinMinNet === Infinity ? 0 : partialWinMinNet,
    partialWinMaxNet: partialWinMaxNet === -Infinity ? 0 : partialWinMaxNet,
    pushPockets,
    partialLossPockets,
    partialLossMinNet: partialLossMinNet === Infinity ? 0 : partialLossMinNet,
    partialLossMaxNet: partialLossMaxNet === -Infinity ? 0 : partialLossMaxNet,
    totalLossPockets,
    pocketPayouts,
  };
}

export function formatActionDesc(c: StrategyCondition): string {
  switch (c.action) {
    case 'increase_level':
      return `+${c.actionValue || 1} Level`;
    case 'decrease_level':
      return `−${c.actionValue || 1} Level`;
    case 'goto_level':
      return `Go to L${c.actionValue || 1}`;
    case 'keep_level':
      return 'Stay at Level';
    case 'reset_to_start':
      return 'Reset to L1 & 1.0x';
    case 'revert_to_level':
      return c.actionValue ? `Revert to L${c.actionValue} (Keep Mult)` : 'Revert to L1 (Keep Mult)';
    case 'increase_multiplier':
      return `× Bet +${c.actionValue || 1}`;
    case 'decrease_multiplier':
      return `× Bet −${c.actionValue || 1}`;
    case 'multiply_by':
      return `Multiply Bet ×${c.multiplier || c.actionValue || 1.5}`;
    case 'set_multiplier':
      return `Set Bet ${c.multiplier || c.actionValue || 1.0}×`;
    case 'double_multiplier':
      return 'Double Bet (2×)';
    case 'triple_multiplier':
      return 'Triple Bet (3×)';
    case 'half_multiplier':
      return 'Halve Bet (0.5×)';
    case 'reset_multiplier':
      return 'Reset Multiplier (1.0×)';
    case 'stop_simulation':
      return 'Halt Session Early';
    case 'reset_streak_counters':
      return 'Reset Streak Counters';
    default:
      return String(c.action).replace(/_/g, ' ');
  }
}

/**
 * Pre-processes progression levels into lookup maps for instant Monte Carlo simulation.
 */
function preprocessLevels(levels: ProgressionLevel[], rules: GameRules) {
  const maxPocket = rules === 'USA' ? 38 : 37;

  return levels.map((lvl) => {
    const totalWager = Number(lvl.totalWager) || lvl.placements.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const pocketsPayoutMap: Record<number, number> = {};
    const pocketsHitCountMap: Record<number, number> = {};

    for (let p = 0; p < maxPocket; p++) {
      let pocketPayout = 0;
      let hitCount = 0;
      for (const bet of lvl.placements) {
        const defaultMult = STANDARD_ROULETTE_PAYOUTS[bet.betType] || 1.0;
        const mult = defaultMult > 1 ? defaultMult : (bet.multiplier > 0 ? bet.multiplier : defaultMult);
        const winReturn = bet.amount * (mult + 1);

        for (const covered of bet.coveredPockets) {
          const cIdx = rules === 'USA' && String(covered) === '00' ? 37 : Number(covered);
          if (cIdx === p) {
            pocketPayout += winReturn;
            hitCount++;
            break;
          }
        }
      }
      pocketsPayoutMap[p] = pocketPayout;
      pocketsHitCountMap[p] = hitCount;
    }

    const allPayouts = Object.values(pocketsPayoutMap);
    const maxPayout = allPayouts.length > 0 ? Math.max(...allPayouts) : 0;
    const winningPayouts = allPayouts.filter((p) => p > totalWager);
    const minWinPayout = winningPayouts.length > 0 ? Math.min(...winningPayouts) : 0;
    const hasDistinctWinningTiers = (maxPayout - minWinPayout) > 0.01;

    return {
      levelNumber: lvl.levelNumber,
      totalWager,
      pocketsPayoutMap,
      pocketsHitCountMap,
      numPlacements: lvl.placements.length,
      maxPayout,
      hasDistinctWinningTiers,
    };
  });
}

/**
 * Executes high-performance spin-by-spin simulation of the strategy with the user's condition set.
 */
export function executeAdvancedSimulation(config: AdvancedBacktestConfig): AdvancedBacktestResult {
  const {
    initialBankroll,
    totalSpins,
    totalSessions: requestedSessions,
    rules,
    levels,
    stopLoss,
    targetProfit,
    conditions,
  } = config;

  const totalSessions = Math.max(1, requestedSessions || 1);
  const maxPocket = rules === 'USA' ? 38 : 37;
  const processedLevels = preprocessLevels(levels, rules);
  const numLevels = processedLevels.length;

  if (numLevels === 0 || initialBankroll <= 0 || totalSpins <= 0) {
    throw new Error('Please provide a valid strategy with at least 1 level, positive bankroll, and spin count.');
  }

  // Global aggregate tracking across all sessions
  let globalTotalCompletedSpins = 0;
  let globalTotalWins = 0;
  let globalMaxWins = 0;
  let globalPartialWins = 0;
  let globalTotalLosses = 0;
  let globalPartialLosses = 0;
  let globalPushes = 0;

  let globalGrossWinsSum = 0;
  let globalGrossLossesSum = 0;
  let globalTotalWageredSum = 0;
  let globalMaxBetSize = 0;
  const globalSpinNetWins: number[] = [];

  let globalLongestWinStreak = 0;
  let globalLongestLossStreak = 0;

  const conditionHitsMap: Record<string, number> = {};
  for (const c of conditions) {
    conditionHitsMap[c.id] = 0;
  }

  const levelStatsMap: Record<number, {
    levelNumber: number;
    wager: number;
    timesVisited: number;
    spinsCount: number;
    totalWagered: number;
    maxWins: number;
    partialWins: number;
    totalLosses: number;
    partialLosses: number;
    pushes: number;
    netProfit: number;
  }> = {};

  for (let i = 0; i < numLevels; i++) {
    levelStatsMap[i + 1] = {
      levelNumber: i + 1,
      wager: processedLevels[i].totalWager,
      timesVisited: 0,
      spinsCount: 0,
      totalWagered: 0,
      maxWins: 0,
      partialWins: 0,
      totalLosses: 0,
      partialLosses: 0,
      pushes: 0,
      netProfit: 0,
    };
  }

  const sessions: SessionRecord[] = [];
  let primaryHistory: BacktestHistoryPoint[] = [];

  for (let sIdx = 1; sIdx <= totalSessions; sIdx++) {
    let bankroll = initialBankroll;
    let peakBankroll = initialBankroll;
    let lowestBankroll = initialBankroll;
    let maxDrawdown = 0;

    let sessionWins = 0;
    let sessionMaxWins = 0;
    let sessionPartialWins = 0;
    let sessionTotalLosses = 0;
    let sessionPartialLosses = 0;
    let sessionPushes = 0;

    let currentWinStreak = 0;
    let longestWinStreak = 0;
    let currentLossStreak = 0;
    let longestLossStreak = 0;
    let currentPushStreak = 0;
    let currentNonWinStreak = 0;

    const eventCounts: Record<string, number> = {
      partial_loss: 0,
      total_loss: 0,
      any_loss: 0,
      push: 0,
      partial_win: 0,
      max_win: 0,
      any_win: 0,
      new_peak: 0,
    };

    const conditionTargets: Record<string, number> = {};
    for (const c of conditions) {
      if (c.trigger === 'profit_loss' && c.comparison === 'session_profit_incremental') {
        conditionTargets[c.id] = c.thresholdAmount ?? 20;
      }
    }

    let currentLvlIdx = 0;
    let currentMultiplier = 1.0;
    let consecutiveConditionHits = 0;
    let activeConditionId: string | null = null;
    let stoppedEarly = false;
    let stopReason: string | undefined = undefined;
    let completedSpins = 0;
    let sessionTotalWagered = 0;
    let sessionMaxBetSize = 0;

    const balanceTrajectory: number[] = [Math.round(initialBankroll * 100) / 100];
    const sessionHistory: BacktestHistoryPoint[] = [];

    // Detailed history is kept for session 1 and for all sessions if count <= 100 or spins <= 50,000
    const recordDetailedHistory = sIdx === 1 || totalSessions <= 100 || (totalSessions * totalSpins <= 50000);
    if (recordDetailedHistory) {
      sessionHistory.push({
        spin: 0,
        balance: Math.round(initialBankroll * 100) / 100,
        level: 1,
        multiplier: 1.0,
        outcome: 'initial',
        pocket: '-',
        netWin: 0,
        wager: 0,
        payout: 0,
        cumulativeProfit: 0,
        nextLevel: 1,
        nextMultiplier: 1.0,
      });
    }

    levelStatsMap[1].timesVisited++;

    for (let s = 1; s <= totalSpins; s++) {
      const lvlData = processedLevels[currentLvlIdx];
      let totalWager = Math.round(lvlData.totalWager * currentMultiplier * 100) / 100;
      let scaleFactor = currentMultiplier;

      // Check Ruin / Bankroll exhaustion
      if (bankroll < totalWager) {
        const baseWager = lvlData.totalWager > 0 ? lvlData.totalWager : 1.0;
        const affordableUnits = Math.floor(bankroll / baseWager);
        if (affordableUnits < 1 || bankroll <= 0) {
          stoppedEarly = true;
          stopReason = bankroll <= 0
            ? 'Bankroll fully depleted ($0)'
            : `Ruin / Busted (Insufficient for 1 unit: $${bankroll.toFixed(2)} < $${baseWager.toFixed(2)})`;
          break;
        }
        // Floor to the nearest whole multiple of the base level wager
        // so wagers always remain multiples of the base bet unit
        currentMultiplier = affordableUnits;
        scaleFactor = affordableUnits;
        totalWager = Math.round(baseWager * affordableUnits * 100) / 100;
      }

      completedSpins = s;
      globalTotalCompletedSpins++;
      bankroll -= totalWager;
      globalTotalWageredSum += totalWager;
      sessionTotalWagered += totalWager;
      if (totalWager > globalMaxBetSize) globalMaxBetSize = totalWager;
      if (totalWager > sessionMaxBetSize) sessionMaxBetSize = totalWager;

      const landedPocket = Math.floor(Math.random() * maxPocket);
      const displayPocket = rules === 'USA' && landedPocket === 37 ? '00' : landedPocket;
      const basePayout = lvlData.pocketsPayoutMap[landedPocket] || 0;
      const payout = Math.round(basePayout * scaleFactor * 100) / 100;
      const netWin = Math.round((payout - totalWager) * 100) / 100;
      bankroll = Math.round((bankroll + payout) * 100) / 100;

      globalSpinNetWins.push(netWin);

      // Classify outcome
      let outcome: 'total_loss' | 'partial_loss' | 'push' | 'partial_win' | 'max_win';
      if (payout === 0) {
        outcome = 'total_loss';
        sessionTotalLosses++;
        globalTotalLosses++;
        globalGrossLossesSum += totalWager;
        currentLossStreak++;
        currentNonWinStreak++;
        currentWinStreak = 0;
        currentPushStreak = 0;
        if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
        if (currentLossStreak > globalLongestLossStreak) globalLongestLossStreak = currentLossStreak;
        eventCounts.total_loss++;
        eventCounts.any_loss++;
      } else if (payout < totalWager) {
        outcome = 'partial_loss';
        sessionPartialLosses++;
        globalPartialLosses++;
        globalGrossLossesSum += (totalWager - payout);
        currentLossStreak++;
        currentNonWinStreak++;
        currentWinStreak = 0;
        currentPushStreak = 0;
        if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
        if (currentLossStreak > globalLongestLossStreak) globalLongestLossStreak = currentLossStreak;
        eventCounts.partial_loss++;
        eventCounts.any_loss++;
      } else if (Math.abs(payout - totalWager) < 0.001) {
        outcome = 'push';
        sessionPushes++;
        globalPushes++;
        currentPushStreak++;
        currentNonWinStreak++;
        currentWinStreak = 0;
        currentLossStreak = 0;
        eventCounts.push++;
      } else if (payout > totalWager) {
        currentWinStreak++;
        currentLossStreak = 0;
        currentPushStreak = 0;
        currentNonWinStreak = 0;
        if (basePayout >= lvlData.maxPayout - 0.01 && lvlData.maxPayout > lvlData.totalWager) {
          outcome = 'max_win';
          sessionWins++;
          sessionMaxWins++;
          globalTotalWins++;
          globalMaxWins++;
          globalGrossWinsSum += netWin;
          if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
          if (currentWinStreak > globalLongestWinStreak) globalLongestWinStreak = currentWinStreak;
          eventCounts.max_win++;
          eventCounts.any_win++;
        } else {
          outcome = 'partial_win';
          sessionWins++;
          sessionPartialWins++;
          globalTotalWins++;
          globalPartialWins++;
          globalGrossWinsSum += netWin;
          if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
          if (currentWinStreak > globalLongestWinStreak) globalLongestWinStreak = currentWinStreak;
          eventCounts.partial_win++;
          eventCounts.any_win++;
        }
      } else {
        outcome = 'push';
        sessionPushes++;
        globalPushes++;
        currentPushStreak++;
        currentNonWinStreak++;
        currentWinStreak = 0;
        currentLossStreak = 0;
        eventCounts.push++;
      }

      // Track Peak, Lowest, Drawdown
      const isNewPeak = bankroll > peakBankroll && bankroll > initialBankroll;
      if (bankroll > peakBankroll) {
        peakBankroll = bankroll;
        if (isNewPeak) eventCounts.new_peak++;
      }
      if (bankroll < lowestBankroll) lowestBankroll = bankroll;
      const currentDD = peakBankroll - bankroll;
      if (currentDD > maxDrawdown) maxDrawdown = currentDD;

      balanceTrajectory.push(Math.round(bankroll * 100) / 100);

      // Record Level Stats
      const curLvlStat = levelStatsMap[currentLvlIdx + 1];
      curLvlStat.spinsCount++;
      curLvlStat.totalWagered += totalWager;
      curLvlStat.netProfit += netWin;
      if (outcome === 'max_win') curLvlStat.maxWins++;
      else if (outcome === 'partial_win') curLvlStat.partialWins++;
      else if (outcome === 'total_loss') curLvlStat.totalLosses++;
      else if (outcome === 'partial_loss') curLvlStat.partialLosses++;
      else if (outcome === 'push') curLvlStat.pushes++;

      const initialLvl = currentLvlIdx + 1;
      const initialMult = currentMultiplier;
      const prevLvlIdx = currentLvlIdx;
      let conditionApplied: string | undefined = undefined;
      let actionTaken: string | undefined = undefined;

      // Condition Evaluation
      for (let cIdx = 0; cIdx < conditions.length; cIdx++) {
        const cond = conditions[cIdx];
        const ruleNum = cIdx + 1;
        let matched = false;

        if (cond.trigger === 'total_loss' || cond.trigger === 'partial_loss' || cond.trigger === 'any_loss' ||
            cond.trigger === 'partial_win' || cond.trigger === 'max_win' || cond.trigger === 'any_win' || cond.trigger === 'push') {
          let isMatch = false;
          if (cond.trigger === 'any_loss') isMatch = outcome === 'total_loss' || outcome === 'partial_loss';
          else if (cond.trigger === 'any_win') isMatch = outcome === 'max_win' || outcome === 'partial_win';
          else isMatch = outcome === cond.trigger;

          if (isMatch) {
            const count = eventCounts[cond.trigger] || 0;
            if (cond.triggerCount <= 1 || (count % cond.triggerCount === 0)) {
              matched = true;
              const labels: Record<string, string> = {
                total_loss: 'Total Loss',
                partial_loss: 'Partial Loss',
                any_loss: 'Any Loss',
                push: 'Push / Break-Even',
                max_win: 'Max Win',
                partial_win: 'Partial Win',
                any_win: 'Any Win',
              };
              const trigName = labels[cond.trigger] || cond.trigger;
              conditionApplied = `Rule #${ruleNum}: ${trigName}${cond.triggerCount > 1 ? ` (every ${cond.triggerCount})` : ''}`;
            }
          }
        } else if (cond.trigger === 'new_peak') {
          if (isNewPeak) {
            const count = eventCounts['new_peak'];
            if (cond.triggerCount <= 1 || (count % cond.triggerCount === 0)) {
              matched = true;
              conditionApplied = `Rule #${ruleNum}: New Peak (+${(bankroll - initialBankroll).toFixed(2)})`;
            }
          }
        } else if (cond.trigger === 'profit_loss') {
          const sessProfit = bankroll - initialBankroll;
          const thresh = cond.thresholdAmount || 0;

          if (cond.comparison === 'session_profit_incremental') {
            const currentTarget = conditionTargets[cond.id] ?? thresh;
            if (sessProfit >= currentTarget) {
              matched = true;
              conditionApplied = `Rule #${ruleNum}: Milestone hit (+${sessProfit.toFixed(1)} ≥ +${currentTarget.toFixed(1)})`;
            }
          } else if (cond.comparison === 'session_profit_gte' && sessProfit >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Session Profit ≥ +${thresh}`;
          } else if (cond.comparison === 'session_loss_gte' && (initialBankroll - bankroll) >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Session Loss ≥ −${thresh}`;
          } else if (cond.comparison === 'spin_profit_gte' && netWin >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Spin Profit ≥ +${thresh}`;
          } else if (cond.comparison === 'spin_loss_gte' && (-netWin) >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Spin Loss ≥ −${thresh}`;
          } else if (cond.comparison === 'peak_profit_giveback') {
            const peakProfit = Math.max(0, peakBankroll - initialBankroll);
            const currentProfit = bankroll - initialBankroll;
            const giveback = peakProfit - currentProfit;
            if (giveback >= thresh && peakProfit > 0) {
              matched = true;
              conditionApplied = `Rule #${ruleNum}: Peak Profit Giveback ≥ $${thresh}`;
            }
          } else if (cond.comparison === 'spin_profit_pct_wager') {
            const multReached = totalWager > 0 ? (payout / totalWager) : 0;
            if (multReached >= (thresh || 2)) {
              matched = true;
              conditionApplied = `Rule #${ruleNum}: Spin Payout ≥ ${thresh}× Wager`;
            }
          }
        } else if (cond.trigger === 'consecutive_losses') {
          const reqCount = cond.triggerCount > 0 ? cond.triggerCount : 2;
          if (currentLossStreak >= reqCount && (currentLossStreak % reqCount === 0 || currentLossStreak === reqCount)) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: ${currentLossStreak} Consecutive Losses`;
          }
        } else if (cond.trigger === 'consecutive_wins') {
          const reqCount = cond.triggerCount > 0 ? cond.triggerCount : 2;
          if (currentWinStreak >= reqCount && (currentWinStreak % reqCount === 0 || currentWinStreak === reqCount)) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: ${currentWinStreak} Consecutive Wins`;
          }
        } else if (cond.trigger === 'consecutive_pushes') {
          const reqCount = cond.triggerCount > 0 ? cond.triggerCount : 2;
          if (currentPushStreak >= reqCount && (currentPushStreak % reqCount === 0 || currentPushStreak === reqCount)) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: ${currentPushStreak} Consecutive Pushes`;
          }
        } else if (cond.trigger === 'consecutive_non_wins') {
          const reqCount = cond.triggerCount > 0 ? cond.triggerCount : 2;
          if (currentNonWinStreak >= reqCount && (currentNonWinStreak % reqCount === 0 || currentNonWinStreak === reqCount)) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: ${currentNonWinStreak} Non-Winning Spins`;
          }
        } else if (cond.trigger === 'drawdown_gte') {
          const thresh = cond.thresholdAmount || 0;
          if (currentDD >= thresh && thresh > 0) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Drawdown ≥ $${thresh}`;
          }
        } else if (cond.trigger === 'drawdown_percent_gte') {
          const currentDDPct = peakBankroll > 0 ? (currentDD / peakBankroll) * 100 : 0;
          const thresh = cond.thresholdAmount || 20;
          if (currentDDPct >= thresh && thresh > 0) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Drawdown ≥ ${currentDDPct.toFixed(1)}% (Target: ${thresh}%)`;
          }
        } else if (cond.trigger === 'bankroll_remaining_lte') {
          const thresh = cond.thresholdAmount !== undefined ? cond.thresholdAmount : (initialBankroll * 0.25);
          if (bankroll <= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Bankroll Low ($${bankroll.toFixed(2)} ≤ $${thresh})`;
          }
        } else if (cond.trigger === 'session_roi_gte') {
          const currentROI = initialBankroll > 0 ? ((bankroll - initialBankroll) / initialBankroll) * 100 : 0;
          const thresh = cond.thresholdAmount || 25;
          if (currentROI >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Session ROI ≥ +${thresh}% (Current: +${currentROI.toFixed(1)}%)`;
          }
        } else if (cond.trigger === 'level_reached') {
          const targetL = cond.actionValue || cond.thresholdAmount || 1;
          if ((currentLvlIdx + 1) === targetL) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Reached Level L${targetL}`;
          }
        } else if (cond.trigger === 'level_at_least') {
          const targetL = cond.actionValue || cond.thresholdAmount || 2;
          if ((currentLvlIdx + 1) >= targetL) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: At Level L${currentLvlIdx + 1} ≥ L${targetL}`;
          }
        } else if (cond.trigger === 'spin_count_reached') {
          const targetS = cond.thresholdAmount || cond.triggerCount || 50;
          if (s === targetS || (cond.triggerCount > 1 && s % cond.triggerCount === 0)) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Spin #${s} Milestone Reached`;
          }
        } else if (cond.trigger === 'bet_size_gte') {
          const thresh = cond.thresholdAmount || 100;
          if (totalWager >= thresh) {
            matched = true;
            conditionApplied = `Rule #${ruleNum}: Wager $${totalWager.toFixed(2)} ≥ $${thresh}`;
          }
        }

        if (matched) {
          conditionHitsMap[cond.id] = (conditionHitsMap[cond.id] || 0) + 1;

          if (cond.action === 'increase_level') {
            const prevL = currentLvlIdx + 1;
            currentLvlIdx = Math.min(numLevels - 1, currentLvlIdx + (cond.actionValue || 1));
            actionTaken = `Level +${cond.actionValue || 1} (L${prevL} → L${currentLvlIdx + 1})`;
          } else if (cond.action === 'decrease_level') {
            const prevL = currentLvlIdx + 1;
            currentLvlIdx = Math.max(0, currentLvlIdx - (cond.actionValue || 1));
            actionTaken = `Level −${cond.actionValue || 1} (L${prevL} → L${currentLvlIdx + 1})`;
          } else if (cond.action === 'goto_level') {
            currentLvlIdx = Math.max(0, Math.min(numLevels - 1, (cond.actionValue || 1) - 1));
            actionTaken = `Go to Level ${currentLvlIdx + 1}`;
          } else if (cond.action === 'reset_to_start') {
            currentLvlIdx = 0;
            currentMultiplier = 1.0;
            activeConditionId = null;
            consecutiveConditionHits = 0;
            currentWinStreak = 0;
            currentLossStreak = 0;
            currentPushStreak = 0;
            currentNonWinStreak = 0;
            // Clean slate: reset all event counters completely so no past bets/streaks carry over!
            for (const key of Object.keys(eventCounts)) {
              (eventCounts as any)[key] = 0;
            }
            if (cond.comparison === 'session_profit_incremental') {
              const inc = cond.thresholdIncrement ?? (cond.thresholdAmount ?? 0);
              const prevTarget = conditionTargets[cond.id] ?? 0;
              conditionTargets[cond.id] = prevTarget + inc;
              actionTaken = `Reset L1 & 1.0x (Target: +$${prevTarget.toFixed(0)} → +$${conditionTargets[cond.id].toFixed(0)})`;
            } else {
              actionTaken = 'Reset to Level 1 & 1.0x (Fresh Start)';
            }
            break;
          } else if (cond.action === 'revert_to_level') {
            const targetL = cond.actionValue ? Math.max(0, Math.min(numLevels - 1, cond.actionValue - 1)) : 0;
            currentLvlIdx = targetL;
            actionTaken = `Revert to Level ${targetL + 1} (Multiplier maintained at ${currentMultiplier}x)`;
          } else if (cond.action === 'keep_level') {
            actionTaken = 'Stay at Level';
          }

          const advanceIncrementalTarget = () => {
            if (cond.trigger === 'profit_loss' && cond.comparison === 'session_profit_incremental') {
              const inc = cond.thresholdIncrement ?? (cond.thresholdAmount ?? 0);
              conditionTargets[cond.id] = (conditionTargets[cond.id] ?? 0) + inc;
            }
          };

          if (cond.action === 'increase_multiplier') {
            const delta = cond.actionValue > 0 ? cond.actionValue : 1;
            const prevM = currentMultiplier;
            currentMultiplier = Math.round((currentMultiplier + delta) * 1000) / 1000;
            activeConditionId = cond.id;
            actionTaken = `× Bet +${delta} (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'decrease_multiplier') {
            const delta = cond.actionValue > 0 ? cond.actionValue : 1;
            const prevM = currentMultiplier;
            currentMultiplier = Math.max(1.0, Math.round((currentMultiplier - delta) * 1000) / 1000);
            activeConditionId = cond.id;
            actionTaken = `× Bet −${delta} (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'multiply_by') {
            const factor = cond.multiplier !== undefined && cond.multiplier > 0 ? cond.multiplier : (cond.actionValue > 0 ? cond.actionValue : 1.5);
            const prevM = currentMultiplier;
            currentMultiplier = Math.round(currentMultiplier * factor * 1000) / 1000;
            activeConditionId = cond.id;
            actionTaken = `Multiply Bet ×${factor} (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'set_multiplier') {
            const targetM = cond.multiplier !== undefined && cond.multiplier > 0 ? cond.multiplier : (cond.actionValue > 0 ? cond.actionValue : 1.0);
            const prevM = currentMultiplier;
            currentMultiplier = Math.max(0.1, targetM);
            activeConditionId = cond.id;
            actionTaken = `Set Multiplier to ${targetM}x (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'double_multiplier') {
            const prevM = currentMultiplier;
            currentMultiplier = Math.round(currentMultiplier * 2 * 1000) / 1000;
            activeConditionId = cond.id;
            actionTaken = `Double Bet 2× (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'triple_multiplier') {
            const prevM = currentMultiplier;
            currentMultiplier = Math.round(currentMultiplier * 3 * 1000) / 1000;
            activeConditionId = cond.id;
            actionTaken = `Triple Bet 3× (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'half_multiplier') {
            const prevM = currentMultiplier;
            currentMultiplier = Math.max(1.0, Math.round((currentMultiplier / 2) * 1000) / 1000);
            activeConditionId = cond.id;
            actionTaken = `Halve Bet 0.5× (${prevM}x → ${currentMultiplier}x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'reset_multiplier') {
            const prevM = currentMultiplier;
            currentMultiplier = 1.0;
            activeConditionId = null;
            actionTaken = `Reset Multiplier to 1.0x (${prevM}x → 1.0x)`;
            advanceIncrementalTarget();
            break;
          } else if (cond.action === 'reset_streak_counters') {
            currentWinStreak = 0;
            currentLossStreak = 0;
            currentPushStreak = 0;
            currentNonWinStreak = 0;
            actionTaken = 'Reset Streak Counters';
            break;
          } else if (cond.action === 'stop_simulation') {
            actionTaken = 'Halt Session Early';
            stoppedEarly = true;
            stopReason = `Stopped by Rule #${ruleNum}`;
            break;
          }

          const condMult = cond.multiplier !== undefined ? cond.multiplier : 1.0;
          const condMode = cond.multiplierMode || 'fixed';

          if (condMode === 'compound' && condMult !== 1.0) {
            if (activeConditionId === cond.id) {
              consecutiveConditionHits++;
            } else {
              activeConditionId = cond.id;
              consecutiveConditionHits = 1;
            }
            currentMultiplier = Math.pow(condMult, consecutiveConditionHits);
            actionTaken = (actionTaken ? actionTaken + ' • ' : '') + `Compound ${condMult}x (${currentMultiplier.toFixed(1)}x)`;
          } else if (condMult !== 1.0) {
            activeConditionId = cond.id;
            consecutiveConditionHits = 1;
            currentMultiplier = condMult;
            actionTaken = (actionTaken ? actionTaken + ' • ' : '') + `Mult set to ${condMult}x`;
          }

          advanceIncrementalTarget();
          break;
        }
      }

      if (recordDetailedHistory) {
        sessionHistory.push({
          spin: s,
          balance: Math.round(bankroll * 100) / 100,
          level: initialLvl,
          multiplier: initialMult,
          outcome,
          pocket: displayPocket,
          netWin: Math.round(netWin * 100) / 100,
          wager: Math.round(totalWager * 100) / 100,
          payout: Math.round(payout * 100) / 100,
          cumulativeProfit: Math.round((bankroll - initialBankroll) * 100) / 100,
          conditionApplied,
          actionTaken,
          nextLevel: currentLvlIdx + 1,
          nextMultiplier: currentMultiplier,
        });
      }

      if (currentLvlIdx !== prevLvlIdx) {
        levelStatsMap[currentLvlIdx + 1].timesVisited++;
      }

      // Check Take Profit or Stop Loss
      if (targetProfit && (bankroll - initialBankroll) >= targetProfit) {
        stoppedEarly = true;
        stopReason = 'Target Profit Reached';
        break;
      }
      if (stopLoss && (initialBankroll - bankroll) >= stopLoss) {
        stoppedEarly = true;
        stopReason = 'Stop Loss Hit';
        break;
      }
    }

    if (!stoppedEarly && !stopReason) {
      stopReason = 'Completed Max Spins';
    }

    const sessionNet = Math.round((bankroll - initialBankroll) * 100) / 100;
    const sessionRoi = Math.round((sessionNet / initialBankroll) * 10000) / 100;

    const sessionRec: SessionRecord = {
      sessionIndex: sIdx,
      completedSpins,
      stoppedEarly,
      stopReason,
      initialBankroll,
      finalBankroll: Math.round(bankroll * 100) / 100,
      netProfit: sessionNet,
      roiPercent: sessionRoi,
      peakBankroll: Math.round(peakBankroll * 100) / 100,
      lowestBankroll: Math.round(lowestBankroll * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      totalWins: sessionWins,
      maxWins: sessionMaxWins,
      partialWins: sessionPartialWins,
      totalLosses: sessionTotalLosses + sessionPartialLosses,
      partialLosses: sessionPartialLosses,
      pushes: sessionPushes,
      longestWinStreak,
      longestLossStreak,
      totalWagered: Math.round(sessionTotalWagered * 100) / 100,
      maxBetSize: Math.round(sessionMaxBetSize * 100) / 100,
      balanceTrajectory,
      history: recordDetailedHistory ? sessionHistory : undefined,
    };

    sessions.push(sessionRec);
    if (sIdx === 1) {
      primaryHistory = sessionHistory;
    }
  }

  // Multi-session Aggregate Calculations
  const sessionsWon = sessions.filter((s) => s.netProfit > 0).length;
  const sessionsLost = sessions.filter((s) => s.netProfit < 0).length;
  const sessionsBreakeven = sessions.filter((s) => s.netProfit === 0).length;
  const sessionWinRate = Math.round((sessionsWon / totalSessions) * 10000) / 100;

  const targetProfitHits = sessions.filter((s) => s.stopReason === 'Target Profit Reached').length;
  const targetProfitHitRate = Math.round((targetProfitHits / totalSessions) * 10000) / 100;

  const stopLossHits = sessions.filter((s) => s.stopReason === 'Stop Loss Hit').length;
  const stopLossHitRate = Math.round((stopLossHits / totalSessions) * 10000) / 100;

  const bustCount = sessions.filter((s) => s.stopReason === 'Ruin / Busted' || s.stopReason?.includes('Ruin') || s.stopReason?.includes('depleted')).length;
  const bustRate = Math.round((bustCount / totalSessions) * 10000) / 100;

  const totalNetProfitSum = sessions.reduce((acc, s) => acc + s.netProfit, 0);
  const avgProfitPerSession = Math.round((totalNetProfitSum / totalSessions) * 100) / 100;

  const sortedProfits = sessions.map((s) => s.netProfit).sort((a, b) => a - b);
  const medianProfitPerSession = sortedProfits[Math.floor(sortedProfits.length / 2)];

  const bestSessionNet = Math.max(...sessions.map((s) => s.netProfit));
  const worstSessionNet = Math.min(...sessions.map((s) => s.netProfit));
  const avgSpinsPerSession = Math.round((globalTotalCompletedSpins / totalSessions) * 10) / 10;

  const overallPeakBankroll = Math.max(...sessions.map((s) => s.peakBankroll));
  const overallLowestBankroll = Math.min(...sessions.map((s) => s.lowestBankroll));
  const overallMaxDrawdown = Math.max(...sessions.map((s) => s.maxDrawdown));
  const overallMaxDrawdownPercent = overallPeakBankroll > 0 ? Math.round((overallMaxDrawdown / overallPeakBankroll) * 10000) / 100 : 0;

  const allLosses = globalTotalLosses + globalPartialLosses;
  const winRate = globalTotalCompletedSpins > 0 ? Math.round((globalTotalWins / globalTotalCompletedSpins) * 10000) / 100 : 0;
  const lossRate = globalTotalCompletedSpins > 0 ? Math.round((allLosses / globalTotalCompletedSpins) * 10000) / 100 : 0;
  const avgWin = globalTotalWins > 0 ? Math.round((globalGrossWinsSum / globalTotalWins) * 100) / 100 : 0;
  const avgLoss = allLosses > 0 ? Math.round((globalGrossLossesSum / allLosses) * 100) / 100 : 0;

  let expectancyRatio = 0;
  if (lossRate > 0 && avgLoss > 0) {
    expectancyRatio = Math.round(((winRate * avgWin) / (lossRate * avgLoss)) * 100) / 100;
  } else {
    expectancyRatio = globalTotalWins > 0 ? 1.0 : 0.0;
  }

  const expectancyPerSpin = Math.round((((winRate / 100) * avgWin) - ((lossRate / 100) * avgLoss)) * 100) / 100;
  const profitFactor = globalGrossLossesSum > 0 ? Math.round((globalGrossWinsSum / globalGrossLossesSum) * 100) / 100 : (globalGrossWinsSum > 0 ? 99.9 : 0);

  const totalWagered = Math.round(globalTotalWageredSum * 100) / 100;
  const avgBetSize = globalTotalCompletedSpins > 0 ? Math.round((globalTotalWageredSum / globalTotalCompletedSpins) * 100) / 100 : 0;
  const maxBet = Math.round(globalMaxBetSize * 100) / 100;
  const recoveryFactor = overallMaxDrawdown > 0 ? Math.round((totalNetProfitSum / overallMaxDrawdown) * 100) / 100 : (totalNetProfitSum > 0 ? 99.9 : 0);

  let sharpeRatio = 0;
  if (globalTotalCompletedSpins > 1) {
    const meanNetWin = totalNetProfitSum / globalTotalCompletedSpins;
    let varianceSum = 0;
    for (const nw of globalSpinNetWins) {
      varianceSum += Math.pow(nw - meanNetWin, 2);
    }
    const stdDev = Math.sqrt(varianceSum / (globalTotalCompletedSpins - 1));
    if (stdDev > 0) {
      sharpeRatio = Math.round((meanNetWin / stdDev) * Math.sqrt(globalTotalCompletedSpins) * 100) / 100;
    }
  }

  const conditionStats: ConditionTriggerStat[] = conditions.map((c, idx) => {
    const count = conditionHitsMap[c.id] || 0;
    const pct = globalTotalCompletedSpins > 0 ? Math.round((count / globalTotalCompletedSpins) * 1000) / 10 : 0;
    return {
      conditionId: c.id,
      ruleNumber: idx + 1,
      triggerDesc: formatTriggerDesc(c),
      actionDesc: formatActionDesc(c),
      triggerCount: count,
      triggerPercent: pct,
    };
  });

  const levelStats: LevelStats[] = [];
  for (let i = 0; i < numLevels; i++) {
    const st = levelStatsMap[i + 1];
    const spCnt = st.spinsCount;
    const wCnt = st.maxWins + st.partialWins;
    const lCnt = st.totalLosses + st.partialLosses;
    const lWinrate = spCnt > 0 ? Math.round((wCnt / spCnt) * 1000) / 10 : 0;
    const spPct = globalTotalCompletedSpins > 0 ? Math.round((spCnt / globalTotalCompletedSpins) * 1000) / 10 : 0;
    const pnl = Math.round(st.netProfit * 100) / 100;

    let status: LevelStats['status'] = 'Neutral';
    if (pnl > 0) status = 'Profit Driver';
    else if (pnl < -initialBankroll * 0.15) status = 'High Bleed';
    else if (lCnt > wCnt * 2.5) status = 'Drawdown Driver';

    levelStats.push({
      levelNumber: st.levelNumber,
      wager: Math.round(st.wager * 100) / 100,
      timesVisited: st.timesVisited,
      spinsCount: spCnt,
      spinsPercent: spPct,
      totalWagered: Math.round(st.totalWagered * 100) / 100,
      maxWins: st.maxWins,
      partialWins: st.partialWins,
      totalLosses: st.totalLosses,
      partialLosses: st.partialLosses,
      pushes: st.pushes,
      winRate: lWinrate,
      netProfit: pnl,
      status,
    });
  }

  const finalBankroll = totalSessions === 1 ? sessions[0].finalBankroll : Math.round((initialBankroll + avgProfitPerSession) * 100) / 100;
  const netProfit = totalSessions === 1 ? sessions[0].netProfit : Math.round(totalNetProfitSum * 100) / 100;
  const roiPercent = totalSessions === 1 ? sessions[0].roiPercent : Math.round((totalNetProfitSum / (initialBankroll * totalSessions)) * 10000) / 100;

  const aiSuggestions = generateAISuggestions({
    initialBankroll,
    netProfit,
    peakBankroll: overallPeakBankroll,
    maxDrawdown: overallMaxDrawdown,
    maxDrawdownPercent: overallMaxDrawdownPercent,
    completedSpins: globalTotalCompletedSpins,
    totalWins: globalTotalWins,
    totalLosses: allLosses,
    partialWins: globalPartialWins,
    partialLosses: globalPartialLosses,
    winRate,
    avgWin,
    avgLoss,
    expectancyRatio,
    levelStats,
    conditions,
    numLevels,
  });

  return {
    initialBankroll,
    finalBankroll,
    netProfit,
    roiPercent,
    totalSpins,
    completedSpins: totalSessions === 1 ? sessions[0].completedSpins : globalTotalCompletedSpins,
    totalSessions,
    sessionsWon,
    sessionsLost,
    sessionsBreakeven,
    sessionWinRate,
    targetProfitHits,
    targetProfitHitRate,
    stopLossHits,
    stopLossHitRate,
    bustCount,
    bustRate,
    avgProfitPerSession,
    medianProfitPerSession,
    bestSessionNet,
    worstSessionNet,
    avgSpinsPerSession,
    sessions,
    stoppedEarly: totalSessions === 1 ? sessions[0].stoppedEarly : bustCount > 0,
    stopReason: totalSessions === 1 ? sessions[0].stopReason : undefined,
    peakBankroll: overallPeakBankroll,
    lowestBankroll: overallLowestBankroll,
    maxDrawdown: overallMaxDrawdown,
    maxDrawdownPercent: overallMaxDrawdownPercent,
    totalWins: globalTotalWins,
    maxWins: globalMaxWins,
    partialWins: globalPartialWins,
    totalLosses: globalTotalLosses,
    partialLosses: globalPartialLosses,
    pushes: globalPushes,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancyRatio,
    expectancyPerSpin,
    profitFactor,
    longestWinStreak: globalLongestWinStreak,
    longestLossStreak: globalLongestLossStreak,
    totalWagered,
    avgBetSize,
    maxBetSize: maxBet,
    recoveryFactor,
    sharpeRatio,
    conditionStats,
    history: primaryHistory,
    levelStats,
    aiSuggestions,
  };
}

/**
 * Intelligent quantitative AI Strategy Advisor that evaluates the simulation and proposes
 * optimized condition adjustments to improve profitability and capital preservation.
 */
function generateAISuggestions(ctx: {
  initialBankroll: number;
  netProfit: number;
  peakBankroll: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  completedSpins: number;
  totalWins: number;
  totalLosses: number;
  partialWins: number;
  partialLosses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancyRatio: number;
  levelStats: LevelStats[];
  conditions: StrategyCondition[];
  numLevels: number;
}): AISuggestion {
  const {
    initialBankroll,
    netProfit,
    peakBankroll,
    maxDrawdown,
    maxDrawdownPercent,
    partialWins,
    partialLosses,
    conditions,
    numLevels,
  } = ctx;

  const observations: string[] = [];
  const suggestedConditions: StrategyCondition[] = [];
  const conditionReasons: Record<string, string> = {};

  // 1. Existing conditions mapping to prevent duplicates
  const hasTrigger = (t: string) => conditions.some((c) => c.trigger === t);
  const hasProfitTarget = conditions.some(
    (c) => c.trigger === 'profit_loss' && (c.comparison === 'session_profit_gte' || c.comparison === 'session_profit_incremental')
  );
  const hasLossStop = conditions.some(
    (c) => c.trigger === 'profit_loss' && c.comparison === 'session_loss_gte'
  );
  const hasResetOnMaxWin = conditions.some(
    (c) => (c.trigger === 'max_win' || c.trigger === 'any_win') && c.action === 'reset_to_start'
  );
  const hasLossEscalation = conditions.some(
    (c) => (c.trigger === 'total_loss' || c.trigger === 'any_loss') && (c.action === 'increase_level' || c.action === 'increase_multiplier')
  );
  const hasWinEscalation = conditions.some(
    (c) => (c.trigger === 'max_win' || c.trigger === 'any_win') && (c.action === 'increase_level' || c.action === 'increase_multiplier')
  );

  // 2. Archetype detection
  let archetype = 'Dynamic Progression';
  if (numLevels <= 1) {
    archetype = 'Flat Bet / Single-Tier System';
  } else if (hasWinEscalation) {
    archetype = 'Positive Progression (Paroli / Reverse Martingale)';
  } else if (hasLossEscalation) {
    archetype = 'Negative Progression (Martingale / D\'Alembert)';
  }

  // 3. Peak giveback analysis
  const peakGain = Math.max(0, peakBankroll - initialBankroll);
  const currentGain = netProfit;
  const givebackAmount = peakGain > 0 ? (peakBankroll - (initialBankroll + currentGain)) : 0;
  const givebackPercent = peakGain > 0 ? Math.round((givebackAmount / peakGain) * 100) : 0;

  if (peakGain > 25 && givebackPercent >= 35) {
    observations.push(
      `Profit Giveback: Strategy reached a session high of +$${peakGain.toLocaleString()} but surrendered ${givebackPercent}% of peak winnings (-$${Math.round(givebackAmount).toLocaleString()}) before the session ended.`
    );

    if (!hasProfitTarget) {
      const targetVal = Math.max(20, Math.round((peakGain * 0.7) / 10) * 10);
      const condId = 'ai-opt-profit-lock';
      suggestedConditions.push({
        id: condId,
        trigger: 'profit_loss',
        triggerCount: 1,
        comparison: 'session_profit_gte',
        thresholdAmount: targetVal,
        action: 'reset_to_start',
        actionValue: 1,
        reason: `Lock in +$${targetVal} profit (70% of the peak +$${peakGain.toFixed(0)} reached in this simulation) to prevent giving back winnings.`,
      });
      conditionReasons[condId] = `Lock in +$${targetVal} profit (70% of peak +$${peakGain.toFixed(0)})`;
    }
  }

  // 4. Drawdown & Loss Escalation Velocity
  if (maxDrawdownPercent > 25) {
    observations.push(
      `High Drawdown Exposure: Peak capital drawdown reached $${maxDrawdown.toLocaleString()} (${maxDrawdownPercent}% of bankroll).`
    );

    if (numLevels > 1) {
      const fastLossCond = conditions.find(
        (c) => (c.trigger === 'total_loss' || c.trigger === 'any_loss') && c.action === 'increase_level' && c.triggerCount === 1
      );
      if (fastLossCond) {
        const condId = 'ai-opt-loss-dampener';
        suggestedConditions.push({
          id: condId,
          trigger: 'total_loss',
          triggerCount: 2,
          action: 'increase_level',
          actionValue: 1,
          reason: `Dampen escalation: Step up only on every 2 consecutive total losses instead of every 1, cutting progression drawdown velocity by ~45%.`,
        });
        conditionReasons[condId] = `Dampen loss escalation to every 2 losses`;
      }
    }

    if (!hasLossStop) {
      const stopThresh = Math.max(50, Math.round((initialBankroll * 0.35) / 10) * 10);
      const condId = 'ai-opt-drawdown-cap';
      suggestedConditions.push({
        id: condId,
        trigger: 'profit_loss',
        triggerCount: 1,
        comparison: 'session_loss_gte',
        thresholdAmount: stopThresh,
        action: numLevels > 1 ? 'goto_level' : 'reset_to_start',
        actionValue: 1,
        reason: `Circuit breaker: Reset to base wager if cumulative session loss touches -$${stopThresh} (35% bankroll) to avoid gambler ruin.`,
      });
      conditionReasons[condId] = `Circuit breaker at -$${stopThresh} loss threshold`;
    }
  }

  // 5. Partial Outcomes Handling
  if (partialWins > 5 || partialLosses > 5) {
    observations.push(
      `Mixed Payoff Pockets: Detected ${partialWins} partial wins and ${partialLosses} partial losses across the simulation run.`
    );

    if (partialWins > 5 && !hasTrigger('partial_win') && numLevels > 1) {
      const condId = 'ai-opt-partial-win';
      suggestedConditions.push({
        id: condId,
        trigger: 'partial_win',
        triggerCount: 1,
        action: 'decrease_level',
        actionValue: 1,
        reason: `Soft Recovery: On partial wins, step down 1 level to bank chips rather than treating partial return as an all-or-nothing event.`,
      });
      conditionReasons[condId] = `Step down on partial win for soft recovery`;
    }

    if (partialLosses > 5 && !hasTrigger('partial_loss') && numLevels > 1) {
      const condId = 'ai-opt-partial-loss';
      suggestedConditions.push({
        id: condId,
        trigger: 'partial_loss',
        triggerCount: 1,
        action: 'keep_level',
        actionValue: 0,
        reason: `Stay at current level on partial losses since partial wager was returned, avoiding over-escalation.`,
      });
      conditionReasons[condId] = `Hold current level on partial losses`;
    }
  }

  // 6. Base Reset on Primary Max Win
  if (!hasResetOnMaxWin && numLevels > 1) {
    const condId = 'ai-opt-reset-on-win';
    suggestedConditions.push({
      id: condId,
      trigger: 'max_win',
      triggerCount: 1,
      action: 'reset_to_start',
      actionValue: 1,
      reason: `Harvest wins: Reset to Level 1 and 1.0x multiplier immediately after hitting a Max Win payout.`,
    });
    conditionReasons[condId] = `Reset to base bet on max win`;
  }

  // 7. Single Level / Flat Bet Optimization
  if (numLevels <= 1) {
    if (!hasTrigger('new_peak') && !hasProfitTarget) {
      const condId = 'ai-opt-flat-peak-reset';
      suggestedConditions.push({
        id: condId,
        trigger: 'new_peak',
        triggerCount: 1,
        action: 'reset_to_start',
        actionValue: 1,
        reason: `Bankroll High-Water Mark: Reset bet multiplier to 1.0x whenever balance prints a new session high.`,
      });
      conditionReasons[condId] = `Reset multiplier on new peak balance`;
    }
    if (!hasLossEscalation && !hasTrigger('consecutive_losses')) {
      const condId = 'ai-opt-flat-recovery';
      suggestedConditions.push({
        id: condId,
        trigger: 'consecutive_losses',
        triggerCount: 3,
        action: 'double_multiplier',
        actionValue: 2,
        reason: `Controlled Recovery: On 3 consecutive losses, temporarily scale bet 2x to recoup flat betting variance.`,
      });
      conditionReasons[condId] = `2x multiplier on 3 consecutive losses`;
    }
  }

  // 8. Positive Progression Win Cap
  if (hasWinEscalation && !hasTrigger('consecutive_wins')) {
    const condId = 'ai-opt-win-streak-cap';
    suggestedConditions.push({
      id: condId,
      trigger: 'consecutive_wins',
      triggerCount: 3,
      action: 'reset_to_start',
      actionValue: 1,
      reason: `Streak Lock: 3 consecutive wins is the statistical sweet spot for positive progressions. Resetting to base locks in compounded profit.`,
    });
    conditionReasons[condId] = `Lock profit after 3 consecutive wins`;
  }

  // Fallback if strategy was already optimal and none triggered
  if (suggestedConditions.length === 0) {
    if (netProfit > 0) {
      observations.push(
        `Robust Performance: Strategy showed positive net expectancy (+${netProfit.toFixed(2)}) with healthy volatility controls.`
      );
      const condId = 'ai-opt-incremental-growth';
      suggestedConditions.push({
        id: condId,
        trigger: 'profit_loss',
        triggerCount: 1,
        comparison: 'session_profit_incremental',
        thresholdAmount: Math.max(25, Math.round((initialBankroll * 0.1) / 10) * 10),
        thresholdIncrement: Math.max(25, Math.round((initialBankroll * 0.1) / 10) * 10),
        action: 'reset_to_start',
        actionValue: 1,
        reason: `Incremental milestones: Continue compounding with auto-advancing target increments.`,
      });
      conditionReasons[condId] = `Auto-advancing incremental profit targets`;
    } else {
      const condId = 'ai-opt-consec-cap';
      suggestedConditions.push({
        id: condId,
        trigger: 'consecutive_losses',
        triggerCount: 3,
        action: 'reset_to_start',
        actionValue: 1,
        reason: `Stop-loss limit: Reset on 3 consecutive losses to cap downside drift.`,
      });
      conditionReasons[condId] = `Reset on 3 consecutive losses`;
    }
  }

  const diagnosis = netProfit >= 0
    ? `The strategy achieved net positive return (+$${netProfit.toFixed(2)}) operating as a ${archetype}. Volatility analysis shows targeted adjustments to profit locking and partial win management will stabilize the equity curve.`
    : `The strategy incurred net negative variance (-$${Math.abs(netProfit).toFixed(2)}) under a ${archetype} profile. Max drawdown (${maxDrawdownPercent}%) can be significantly curtailed by implementing tailored loss dampeners and circuit breakers.`;

  const predictedImpact = netProfit >= 0
    ? `Secures up to ~${Math.min(85, Math.max(35, givebackPercent))}% of peak captured gains and prevents drawdown erosion during adverse streaks.`
    : `Reduces peak capital drawdown by ~35-50% and prevents catastrophic progression blowouts during prolonged losing runs.`;

  return {
    title: `AI Quantitative Strategy Optimization — ${archetype}`,
    archetype,
    diagnosis,
    keyObservations: observations.length > 0 ? observations : ['Strategy displayed standard variance across outcomes.'],
    reasoning: `Tailored for ${archetype}: Recommendations are customized based on the actual simulated drawdown ($${maxDrawdown.toFixed(0)}) and peak gains (+$${peakGain.toFixed(0)}), without duplicate rules.`,
    suggestedConditions,
    conditionReasons,
    predictedImpact,
  };
}

export const PRESET_STRATEGY_CONDITIONS: { name: string; description: string; conditions: StrategyCondition[] }[] = [
  {
    name: 'Martingale (Classic)',
    description: 'Step up on any loss, reset to Level 1 on any win.',
    conditions: [
      { id: 'm-1', trigger: 'total_loss', triggerCount: 1, action: 'increase_level', actionValue: 1 },
      { id: 'm-2', trigger: 'partial_loss', triggerCount: 1, action: 'increase_level', actionValue: 1 },
      { id: 'm-3', trigger: 'max_win', triggerCount: 1, action: 'reset_to_start', actionValue: 1 },
      { id: 'm-4', trigger: 'partial_win', triggerCount: 1, action: 'reset_to_start', actionValue: 1 },
    ],
  },
  {
    name: "D'Alembert (Balanced Stepped)",
    description: 'Increment 1 level on loss, decrement 1 level on win.',
    conditions: [
      { id: 'd-1', trigger: 'total_loss', triggerCount: 1, action: 'increase_level', actionValue: 1 },
      { id: 'd-2', trigger: 'partial_loss', triggerCount: 1, action: 'increase_level', actionValue: 1 },
      { id: 'd-3', trigger: 'max_win', triggerCount: 1, action: 'decrease_level', actionValue: 1 },
      { id: 'd-4', trigger: 'partial_win', triggerCount: 1, action: 'decrease_level', actionValue: 1 },
    ],
  },
  {
    name: 'Tiered Recovery with Profit Bank',
    description: 'Step up on total losses, step down on partial wins, reset on max win or profit target.',
    conditions: [
      { id: 'tr-1', trigger: 'total_loss', triggerCount: 1, action: 'increase_level', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
      { id: 'tr-2', trigger: 'partial_loss', triggerCount: 2, action: 'increase_level', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
      { id: 'tr-3', trigger: 'partial_win', triggerCount: 1, action: 'decrease_level', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
      { id: 'tr-4', trigger: 'max_win', triggerCount: 1, action: 'reset_to_start', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
      { id: 'tr-5', trigger: 'profit_loss', triggerCount: 1, comparison: 'session_profit_gte', thresholdAmount: 200, action: 'reset_to_start', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
    ],
  },
  {
    name: 'Martingale 2x (Single-Level Compound)',
    description: 'Stay on current level, doubling bet on loss and resetting to 1x on win.',
    conditions: [
      { id: 'm2-1', trigger: 'total_loss', triggerCount: 1, action: 'keep_level', actionValue: 0, multiplier: 2.0, multiplierMode: 'compound' },
      { id: 'm2-2', trigger: 'partial_loss', triggerCount: 1, action: 'keep_level', actionValue: 0, multiplier: 2.0, multiplierMode: 'compound' },
      { id: 'm2-3', trigger: 'max_win', triggerCount: 1, action: 'reset_to_start', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
      { id: 'm2-4', trigger: 'partial_win', triggerCount: 1, action: 'reset_to_start', actionValue: 1, multiplier: 1.0, multiplierMode: 'fixed' },
    ],
  },
  {
    name: "D'Alembert Multiplier + Incremental Target",
    description: 'Level 1 multiplier scaling (+1 on loss, -1 on win) with auto-advancing session profit goal.',
    conditions: [
      { id: 'dal-1', trigger: 'total_loss', triggerCount: 1, action: 'increase_multiplier', actionValue: 1 },
      { id: 'dal-2', trigger: 'partial_loss', triggerCount: 2, action: 'increase_multiplier', actionValue: 1 },
      { id: 'dal-3', trigger: 'partial_win', triggerCount: 2, action: 'decrease_multiplier', actionValue: 1 },
      { id: 'dal-4', trigger: 'max_win', triggerCount: 1, action: 'decrease_multiplier', actionValue: 1 },
      { id: 'dal-5', trigger: 'profit_loss', triggerCount: 1, comparison: 'session_profit_incremental', thresholdAmount: 20, thresholdIncrement: 20, action: 'reset_to_start', actionValue: 1 },
    ],
  },
  {
    name: 'High-Water Mark (Peak) Reset',
    description: 'Step up level on any loss, and lock in session peak profits by resetting to L1 whenever bankroll reaches a new high.',
    conditions: [
      { id: 'peak-1', trigger: 'any_loss', triggerCount: 1, action: 'increase_level', actionValue: 1 },
      { id: 'peak-2', trigger: 'new_peak', triggerCount: 1, action: 'reset_to_start', actionValue: 1 },
    ],
  },
];


