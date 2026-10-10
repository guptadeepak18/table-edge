import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(50), default="user")  # 'admin', 'user', 'manager'
    phone = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    subscription = relationship("Subscription", back_populates="user", uselist=False)

class SubscriptionTier(Base):
    __tablename__ = "subscription_tiers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(50), nullable=False)  # e.g., 'Free', 'Pro'
    price_cents = Column(Integer, default=0)
    billing_frequency = Column(String(50), default="monthly")  # monthly, quarterly, annual, lifetime, weekly, one-time
    model_type = Column(String(50), default="subscription")    # freemium, subscription, lifetime, trial
    description = Column(String(255), nullable=True)
    badge_text = Column(String(50), nullable=True)
    billing_provider_price_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    configs = relationship("TierConfig", back_populates="tier", cascade="all, delete-orphan")

class TierConfig(Base):
    __tablename__ = "tier_config"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tier_id = Column(String(36), ForeignKey("subscription_tiers.id"), nullable=False)
    config_key = Column(String(100), nullable=False)
    config_value = Column(JSON, nullable=False)

    tier = relationship("SubscriptionTier", back_populates="configs")

class TierConfigAuditLog(Base):
    __tablename__ = "tier_config_audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tier_id = Column(String(36), nullable=False)
    changed_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    tier_id = Column(String(36), ForeignKey("subscription_tiers.id"), nullable=False)
    status = Column(String(20), default="active")  # active, canceled, past_due
    billing_provider_ref = Column(String(100), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="subscription")
    tier = relationship("SubscriptionTier")
