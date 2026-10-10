import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class GameSession(Base):
    __tablename__ = "game_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    rules = Column(String(10), default="EUR")
    starting_bankroll = Column(Float, nullable=False)
    ending_bankroll = Column(Float, nullable=False)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)

    spins = relationship("Spin", back_populates="session", cascade="all, delete-orphan")

class Spin(Base):
    __tablename__ = "spins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("game_sessions.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    backtest_run_id = Column(String(36), nullable=True)
    strategy_name = Column(String(100), default="Manual Bet")
    strategy_level = Column(Integer, default=1)
    rules = Column(String(10), default="EUR")
    pocket_number = Column(String(10), nullable=False)  # string to support "00"
    color = Column(String(10), nullable=False)
    total_bet = Column(Float, default=0.0)
    total_payout = Column(Float, default=0.0)
    net_win = Column(Float, default=0.0)
    resulting_bankroll = Column(Float, nullable=True)
    bet_details = Column(JSON, nullable=True)  # Detailed placed bets breakdown
    rng_method = Column(String(50), default="secrets.randbelow")
    seed_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session = relationship("GameSession", back_populates="spins")

class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    rules = Column(String(10), default="EUR")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    levels = relationship("StrategyLevel", back_populates="strategy", cascade="all, delete-orphan", order_by="StrategyLevel.level_number")

class StrategyLevel(Base):
    __tablename__ = "strategy_levels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    strategy_id = Column(String(36), ForeignKey("strategies.id"), nullable=False)
    level_number = Column(Integer, nullable=False)
    total_wager = Column(Float, default=0.0)

    strategy = relationship("Strategy", back_populates="levels")
    placements = relationship("BetPlacementModel", back_populates="strategy_level", cascade="all, delete-orphan")

class BetPlacementModel(Base):
    __tablename__ = "bet_placements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    strategy_level_id = Column(String(36), ForeignKey("strategy_levels.id"), nullable=False)
    bet_type = Column(String(50), nullable=False)
    covered_pockets = Column(JSON, nullable=False)  # JSON list of pockets
    amount = Column(Float, nullable=False)
    multiplier = Column(Float, nullable=False)

    strategy_level = relationship("StrategyLevel", back_populates="placements")

class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    strategy_id = Column(String(36), ForeignKey("strategies.id"), nullable=True)
    initial_bankroll = Column(Float, nullable=False)
    total_sessions = Column(Integer, nullable=False)
    sessions_won = Column(Integer, nullable=False)
    sessions_lost = Column(Integer, nullable=False)
    max_drawdown = Column(Float, nullable=False)
    final_bankroll = Column(Float, nullable=False)
    session_history = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class CustomConditionOption(Base):
    __tablename__ = "custom_condition_options"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String(50), nullable=False)  # 'trigger', 'action', 'comparison'
    value = Column(String(100), nullable=False, unique=True)
    label = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    parameters_schema = Column(JSON, nullable=True)
    created_by = Column(String(100), default="ai_natural_language")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

