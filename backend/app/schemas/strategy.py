from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal, Union
from datetime import datetime
import uuid
from app.schemas.game import ProgressionLevel, GameRules

TriggerType = Union[
    Literal[
        "partial_loss",
        "total_loss",
        "any_loss",
        "push",
        "partial_win",
        "max_win",
        "any_win",
        "profit_loss",
        "new_peak",
        "consecutive_losses",
        "consecutive_wins",
        "consecutive_pushes",
        "consecutive_non_wins",
        "drawdown_gte",
        "drawdown_percent_gte",
        "bankroll_remaining_lte",
        "session_roi_gte",
        "level_reached",
        "level_at_least",
        "spin_count_reached",
        "bet_size_gte"
    ],
    str
]

ActionType = Union[
    Literal[
        "increase_level",
        "decrease_level",
        "goto_level",
        "revert_to_level",
        "reset_to_start",
        "keep_level",
        "increase_multiplier",
        "decrease_multiplier",
        "multiply_by",
        "set_multiplier",
        "double_multiplier",
        "triple_multiplier",
        "half_multiplier",
        "reset_multiplier",
        "reset_streak_counters",
        "stop_simulation"
    ],
    str
]

ComparisonType = Union[
    Literal[
        "session_profit_gte",
        "session_loss_gte",
        "spin_profit_gte",
        "spin_loss_gte",
        "session_profit_incremental",
        "peak_profit_giveback",
        "spin_profit_pct_wager"
    ],
    str
]

class StrategyCondition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trigger: TriggerType
    trigger_count: int = Field(alias="triggerCount", default=1, ge=1)
    comparison: Optional[ComparisonType] = None
    threshold_amount: Optional[float] = Field(alias="thresholdAmount", default=None)
    threshold_increment: Optional[float] = Field(alias="thresholdIncrement", default=None)
    action: ActionType
    action_value: int = Field(alias="actionValue", default=1, ge=0)
    multiplier: float = Field(alias="multiplier", default=1.0, gt=0)
    multiplier_mode: Optional[str] = Field(alias="multiplierMode", default="fixed")
    reason: Optional[str] = Field(default=None)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class LevelStats(BaseModel):
    level_number: int = Field(alias="levelNumber")
    wager: float
    times_visited: int = Field(alias="timesVisited", default=0)
    spins_count: int = Field(alias="spinsCount", default=0)
    spins_percent: float = Field(alias="spinsPercent", default=0.0)
    total_wagered: float = Field(alias="totalWagered", default=0.0)
    max_wins: int = Field(alias="maxWins", default=0)
    partial_wins: int = Field(alias="partialWins", default=0)
    total_losses: int = Field(alias="totalLosses", default=0)
    partial_losses: int = Field(alias="partialLosses", default=0)
    pushes: int = 0
    win_rate: float = Field(alias="winRate", default=0.0)
    net_profit: float = Field(alias="netProfit", default=0.0)
    status: str = "Neutral"

    model_config = {
        "populate_by_name": True
    }

class AISuggestion(BaseModel):
    title: str
    diagnosis: str
    key_observations: List[str] = Field(alias="keyObservations", default=[])
    reasoning: str
    suggested_conditions: List[StrategyCondition] = Field(alias="suggestedConditions", default=[])
    condition_reasons: Optional[Dict[str, str]] = Field(alias="conditionReasons", default=None)
    predicted_impact: str = Field(alias="predictedImpact", default="")
    archetype: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }

class ConditionTriggerStat(BaseModel):
    condition_id: str = Field(alias="conditionId")
    rule_number: int = Field(alias="ruleNumber")
    trigger_desc: str = Field(alias="triggerDesc")
    action_desc: str = Field(alias="actionDesc")
    trigger_count: int = Field(alias="triggerCount")
    trigger_percent: float = Field(alias="triggerPercent")

    model_config = {
        "populate_by_name": True
    }

class BacktestHistoryPoint(BaseModel):
    spin: int
    balance: float
    level: int
    multiplier: float = 1.0
    outcome: str
    pocket: Optional[Union[int, str]] = None
    net_win: float = Field(alias="netWin")
    wager: float
    payout: float
    cumulative_profit: float = Field(alias="cumulativeProfit", default=0.0)
    condition_applied: Optional[str] = Field(alias="conditionApplied", default=None)
    action_taken: Optional[str] = Field(alias="actionTaken", default=None)
    next_level: Optional[int] = Field(alias="nextLevel", default=None)
    next_multiplier: Optional[float] = Field(alias="nextMultiplier", default=None)

    model_config = {
        "populate_by_name": True
    }

class SessionRecord(BaseModel):
    session_index: int = Field(alias="sessionIndex")
    completed_spins: int = Field(alias="completedSpins")
    stopped_early: bool = Field(alias="stoppedEarly", default=False)
    stop_reason: Optional[str] = Field(alias="stopReason", default=None)
    initial_bankroll: float = Field(alias="initialBankroll")
    final_bankroll: float = Field(alias="finalBankroll")
    net_profit: float = Field(alias="netProfit")
    roi_percent: float = Field(alias="roiPercent")
    peak_bankroll: float = Field(alias="peakBankroll")
    lowest_bankroll: float = Field(alias="lowestBankroll")
    max_drawdown: float = Field(alias="maxDrawdown")
    total_wins: int = Field(alias="totalWins", default=0)
    total_losses: int = Field(alias="totalLosses", default=0)
    pushes: int = 0
    balance_trajectory: List[float] = Field(alias="balanceTrajectory", default=[])

    model_config = {
        "populate_by_name": True
    }

class AdvancedBacktestConfig(BaseModel):
    initial_bankroll: float = Field(alias="initialBankroll", default=1000.0, gt=0)
    total_spins: int = Field(alias="totalSpins", default=100, ge=1, le=100000)
    total_sessions: int = Field(alias="totalSessions", default=1, ge=1, le=10000)
    rules: GameRules = "EUR"
    levels: List[ProgressionLevel] = []
    stop_loss: Optional[float] = Field(alias="stopLoss", default=None)
    target_profit: Optional[float] = Field(alias="targetProfit", default=None)
    conditions: List[StrategyCondition] = []

    model_config = {
        "populate_by_name": True
    }

class AdvancedBacktestResult(BaseModel):
    initial_bankroll: float = Field(alias="initialBankroll")
    final_bankroll: float = Field(alias="finalBankroll")
    net_profit: float = Field(alias="netProfit")
    roi_percent: float = Field(alias="roiPercent")
    total_spins: int = Field(alias="totalSpins")
    completed_spins: int = Field(alias="completedSpins")
    total_sessions: int = Field(alias="totalSessions", default=1)
    sessions_won: int = Field(alias="sessionsWon", default=0)
    sessions_lost: int = Field(alias="sessionsLost", default=0)
    sessions_breakeven: int = Field(alias="sessionsBreakeven", default=0)
    session_win_rate: float = Field(alias="sessionWinRate", default=0.0)
    target_profit_hits: int = Field(alias="targetProfitHits", default=0)
    target_profit_hit_rate: float = Field(alias="targetProfitHitRate", default=0.0)
    stop_loss_hits: int = Field(alias="stopLossHits", default=0)
    stop_loss_hit_rate: float = Field(alias="stopLossHitRate", default=0.0)
    bust_count: int = Field(alias="bustCount", default=0)
    bust_rate: float = Field(alias="bustRate", default=0.0)
    avg_profit_per_session: float = Field(alias="avgProfitPerSession", default=0.0)
    median_profit_per_session: float = Field(alias="medianProfitPerSession", default=0.0)
    best_session_net: float = Field(alias="bestSessionNet", default=0.0)
    worst_session_net: float = Field(alias="worstSessionNet", default=0.0)
    avg_spins_per_session: float = Field(alias="avgSpinsPerSession", default=0.0)
    sessions: List[SessionRecord] = Field(default=[])
    stopped_early: bool = Field(alias="stoppedEarly", default=False)
    stop_reason: Optional[str] = Field(alias="stopReason", default=None)
    peak_bankroll: float = Field(alias="peakBankroll")
    lowest_bankroll: float = Field(alias="lowestBankroll")
    max_drawdown: float = Field(alias="maxDrawdown")
    max_drawdown_percent: float = Field(alias="maxDrawdownPercent")
    total_wins: int = Field(alias="totalWins")
    max_wins: int = Field(alias="maxWins")
    partial_wins: int = Field(alias="partialWins")
    total_losses: int = Field(alias="totalLosses")
    partial_losses: int = Field(alias="partialLosses")
    pushes: int
    win_rate: float = Field(alias="winRate")
    loss_rate: float = Field(alias="lossRate")
    avg_win: float = Field(alias="avgWin")
    avg_loss: float = Field(alias="avgLoss")
    expectancy_ratio: float = Field(alias="expectancyRatio")
    expectancy_per_spin: float = Field(alias="expectancyPerSpin")
    profit_factor: float = Field(alias="profitFactor")
    longest_win_streak: int = Field(alias="longestWinStreak")
    longest_loss_streak: int = Field(alias="longestLossStreak")
    total_wagered: float = Field(alias="totalWagered", default=0.0)
    avg_bet_size: float = Field(alias="avgBetSize", default=0.0)
    max_bet_size: float = Field(alias="maxBetSize", default=0.0)
    recovery_factor: float = Field(alias="recoveryFactor", default=0.0)
    sharpe_ratio: float = Field(alias="sharpeRatio", default=0.0)
    condition_stats: List[ConditionTriggerStat] = Field(alias="conditionStats", default=[])
    history: List[BacktestHistoryPoint]
    level_stats: List[LevelStats] = Field(alias="levelStats")
    ai_suggestions: Optional[AISuggestion] = Field(alias="aiSuggestions", default=None)

    model_config = {
        "populate_by_name": True
    }

class BacktestConfig(BaseModel):
    initial_bankroll: float = Field(default=1000.0, gt=0)
    total_sessions: int = Field(default=1000, ge=1, le=100000)
    rules: GameRules = "EUR"
    levels: List[ProgressionLevel]
    stop_loss: Optional[float] = None
    target_profit: Optional[float] = None

class BacktestResult(BaseModel):
    initial_bankroll: float
    total_sessions: int
    sessions_won: int
    sessions_lost: int
    win_rate: float
    max_drawdown: float
    max_drawdown_percent: float
    peak_bankroll: float
    final_bankroll: float
    net_profit: float
    history: List[float]

class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rules: GameRules = "EUR"
    levels: List[ProgressionLevel]

class StrategyResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    rules: GameRules
    levels: List[ProgressionLevel]
    created_at: str
    updated_at: str

class CustomOptionCreate(BaseModel):
    category: Literal["trigger", "action", "comparison"]
    value: str = Field(min_length=2, max_length=100)
    label: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = "community"

class CustomOptionResponse(BaseModel):
    id: str
    category: str
    value: str
    label: str
    description: Optional[str] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None

    model_config = {
        "from_attributes": True
    }

class ConditionOptionItem(BaseModel):
    value: str
    label: str
    description: Optional[str] = None
    category: str
    is_custom: bool = False

class ConditionOptionsListResponse(BaseModel):
    triggers: List[ConditionOptionItem]
    actions: List[ConditionOptionItem]
    comparisons: List[ConditionOptionItem]

class NaturalLanguageStrategyRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    rules: GameRules = "EUR"
    bankroll: Optional[float] = None

class StrategyExecutionParameters(BaseModel):
    bankroll: Optional[float] = 1000.0
    total_spins: Optional[int] = 100
    total_sessions: Optional[int] = 10
    stop_loss: Optional[float] = None
    target_profit: Optional[float] = None

class NaturalLanguageStrategyResponse(BaseModel):
    strategy_name: str
    explanation: str
    rules: GameRules = "EUR"
    parameters: StrategyExecutionParameters
    levels: List[ProgressionLevel]
    conditions: List[StrategyCondition]
    new_options_created: List[CustomOptionResponse] = []
    used_ai_model: Optional[str] = None

class AIConditionSuggestionRequest(BaseModel):
    strategy_name: Optional[str] = None
    rules: GameRules = "EUR"
    bankroll: Optional[float] = 1000.0
    levels: List[ProgressionLevel]
    target_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    existing_conditions: Optional[List[StrategyCondition]] = []
    model_provider: Optional[str] = "auto"
    optimization_goal: Optional[str] = "max_win_rate"

class AIConditionSuggestionResponse(BaseModel):
    title: str
    diagnosis: str
    mathematical_edge_summary: str
    suggested_conditions: List[StrategyCondition]
    condition_reasons: Dict[str, str] = {}
    predicted_impact: str
    archetype: str
    used_ai_model: str


