import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class CasinoConfig(Base):
    __tablename__ = "casino_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    casino_id = Column(String(100), nullable=False)
    provider = Column(String(50), default="pragmatic")
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class LiveTrackingSession(Base):
    __tablename__ = "live_tracking_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    rules = Column(String(10), default="EUR")
    casino = Column(String(100), nullable=True)
    table_id = Column(String(50), nullable=True)
    dealer_name = Column(String(100), nullable=True)
    label = Column(String(150), default="Live Session")
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)

    entries = relationship("LiveSpinEntry", back_populates="live_session", cascade="all, delete-orphan", order_by="LiveSpinEntry.sequence_order")

class LiveSpinEntry(Base):
    __tablename__ = "live_spin_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    live_session_id = Column(String(36), ForeignKey("live_tracking_sessions.id"), nullable=False)
    pocket_number = Column(String(10), nullable=False)
    direction = Column(String(10), default="cw")
    sequence_order = Column(Integer, nullable=False)
    segment_index = Column(Integer, nullable=False)  # 1-6
    offset_from_previous = Column(Integer, nullable=True)
    entered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    live_session = relationship("LiveTrackingSession", back_populates="entries")

class TableDealerSpinHistory(Base):
    """
    Permanent master ledger of all historical spins partitioned by table and dealer.
    Allows independent analysis of:
    1. Table Physical Wheel Bias (wheel balance, pocket frets, tilt across all dealers).
    2. Dealer Motor Habit Bias (signature velocity, flick consistency, drop offset across tables).
    """
    __tablename__ = "table_dealer_spin_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id = Column(String(100), unique=True, index=True, nullable=True)
    table_id = Column(String(50), index=True, nullable=False)
    table_name = Column(String(100), nullable=True)
    dealer_name = Column(String(100), index=True, nullable=True)
    dealer_id = Column(String(50), nullable=True)
    pocket_number = Column(Integer, nullable=False)
    color = Column(String(10), nullable=False)
    direction = Column(String(10), default="cw")
    segment_index = Column(Integer, nullable=False)  # 1-6
    offset_from_previous = Column(Integer, nullable=True)
    spun_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

