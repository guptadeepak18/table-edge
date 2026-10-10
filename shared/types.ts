export type GameRules = 'EUR' | 'USA';

export type WheelRotationMode = 'cw' | 'ccw' | 'alternating';

export type SpinDirection = 'cw' | 'ccw';

export type PocketValue = number | '00';

export interface Chip {
  id: string;
  denomination: 1 | 5 | 10 | 20 | 40 | 100;
  color: string;
  label: string;
}

export type BetType =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'sixline'
  | 'dozen'
  | 'column'
  | 'outside_red'
  | 'outside_black'
  | 'outside_even'
  | 'outside_odd'
  | 'outside_low'
  | 'outside_high';

export interface BetPlacement {
  id: string;
  betType: BetType;
  coordinateX: number;
  coordinateY: number;
  coveredPockets: (number | '00')[];
  amount: number;
  multiplier: number;
}

export interface ProgressionLevel {
  levelNumber: number;
  totalWager: number;
  placements: BetPlacement[];
}

export interface Strategy {
  id: string;
  userId?: string;
  name: string;
  rules: GameRules;
  levels: ProgressionLevel[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SpinResult {
  id: string;
  pocketNumber: number | '00';
  color: 'red' | 'black' | 'green';
  timestamp: number;
  totalBet: number;
  totalPayout: number;
  netWin: number;
  resultingBankroll: number;
  rngMethod: string;
  seedHash?: string;
}

export interface BacktestConfig {
  initialBankroll: number;
  totalSessions: number;
  rules: GameRules;
  levels: ProgressionLevel[];
  stopLoss?: number;
  targetProfit?: number;
}

export interface BacktestResult {
  initialBankroll: number;
  totalSessions: number;
  sessionsWon: number;
  sessionsLost: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakBankroll: number;
  finalBankroll: number;
  netProfit: number;
  history: number[]; // Bankroll snapshot per session
}

// Module B: Dealer Signature Tracker models
export interface LiveSpinEntry {
  id: string;
  pocketNumber: number | '00';
  direction: SpinDirection;
  sequenceOrder: number;
  enteredAt: string;
  segmentIndex: number; // 1 through 6
  offsetFromPrevious?: number; // angular/pocket offset based on direction
}

export interface LiveTrackingSession {
  id: string;
  userId?: string;
  rules: GameRules;
  casino?: string;
  tableId?: string;
  dealerName?: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  entries: LiveSpinEntry[];
}

export interface WheelSegmentStats {
  segmentIndex: number; // 1-6
  pocketCount: number;
  pockets: (number | '00')[];
  hitCount: number;
  hitPercentage: number;
  zScore: number;
}

export interface SectorPrediction {
  predictedSegment: number; // 1-6
  confidenceScore: number; // 0 to 100%
  topNumbers: (number | '00')[];
  dominantOffset: number;
  rationale: string;
}

export interface LiveSessionAnalytics {
  totalSpins: number;
  straightFrequency: Record<string, number>;
  rollingHot: (number | '00')[];
  rollingCold: (number | '00')[];
  segmentStats: WheelSegmentStats[];
  offsetFrequencies: Record<number, number>;
  dominantOffset: number;
  prediction?: SectorPrediction;
}

// Admin and Entitlements
export interface SubscriptionTier {
  id: string;
  name: string;
  priceCents: number;
  billingProviderPriceId?: string;
  isActive: boolean;
  config: Record<string, any>;
}

export interface TierConfigAuditLog {
  id: string;
  tierId: string;
  changedBy: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  changedAt: string;
}
