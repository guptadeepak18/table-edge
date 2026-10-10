import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User, Subscription, SubscriptionTier, TierConfig
from app.core.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str
    new_password: Optional[str] = None

class UpgradeRequest(BaseModel):
    tier_id: str = "tier-pro"

async def build_user_response(user: User, db: AsyncSession) -> Dict[str, Any]:
    # Fetch subscription and tier
    sub_res = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = sub_res.scalar_one_or_none()
    
    tier_info = None
    configs = {}
    tier_id = "tier-free"
    
    if sub:
        tier_id = sub.tier_id
        t_res = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == sub.tier_id))
        t = t_res.scalar_one_or_none()
        if t:
            tier_info = {
                "id": t.id,
                "name": t.name,
                "price_cents": t.price_cents,
                "billing_frequency": getattr(t, "billing_frequency", "monthly") or "monthly",
                "model_type": getattr(t, "model_type", "subscription") or "subscription",
                "description": getattr(t, "description", "") or "",
                "badge_text": getattr(t, "badge_text", "") or "",
                "is_active": t.is_active,
            }
    else:
        # Fallback tier info
        t_res = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == "tier-free"))
        t = t_res.scalar_one_or_none()
        if t:
            tier_info = {
                "id": t.id,
                "name": t.name,
                "price_cents": t.price_cents,
                "billing_frequency": getattr(t, "billing_frequency", "monthly") or "monthly",
                "model_type": getattr(t, "model_type", "subscription") or "subscription",
                "description": getattr(t, "description", "") or "",
                "badge_text": getattr(t, "badge_text", "") or "",
                "is_active": t.is_active,
            }

    # Fetch tier configs
    cfg_res = await db.execute(select(TierConfig).where(TierConfig.tier_id == tier_id))
    configs = {c.config_key: c.config_value for c in cfg_res.scalars().all()}

    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name or user.email.split("@")[0],
        "is_admin": bool(user.is_admin or user.role == "admin"),
        "role": user.role or "user",
        "is_active": bool(user.is_active),
        "phone": user.phone or "",
        "notes": user.notes or "",
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "subscription": {
            "tier_id": tier_id,
            "status": sub.status if sub else "active",
            "tier": tier_info,
            "configs": configs,
        }
    }

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    existing = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email address already exists")

    new_user = User(
        id=str(uuid.uuid4()),
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        display_name=req.display_name.strip() if req.display_name else req.email.split("@")[0],
        phone=req.phone.strip() if req.phone else None,
        role="user",
        is_admin=False,
        is_active=True,
        last_login_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    await db.flush()

    # Create free subscription
    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=new_user.id,
        tier_id="tier-free",
        status="active"
    )
    db.add(sub)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({"sub": new_user.id, "email": new_user.email, "role": new_user.role})
    user_data = await build_user_response(new_user, db)

    return {
        "token": token,
        "user": user_data
    }

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended or deactivated. Please contact support."
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    user_data = await build_user_response(user, db)

    return {
        "token": token,
        "user": user_data
    }

@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await build_user_response(user, db)

@router.get("/tiers")
async def get_available_tiers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubscriptionTier).where(SubscriptionTier.is_active == True))
    tiers = result.scalars().all()
    out = []
    for t in tiers:
        cfg_res = await db.execute(select(TierConfig).where(TierConfig.tier_id == t.id))
        configs = {c.config_key: c.config_value for c in cfg_res.scalars().all()}
        out.append({
            "id": t.id,
            "name": t.name,
            "price_cents": t.price_cents,
            "billing_frequency": getattr(t, "billing_frequency", "monthly") or "monthly",
            "model_type": getattr(t, "model_type", "subscription") or "subscription",
            "description": getattr(t, "description", "") or "",
            "badge_text": getattr(t, "badge_text", "") or "",
            "config": configs,
        })
    return out

@router.post("/upgrade")
async def upgrade_subscription(
    req: UpgradeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify tier exists
    tier_res = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == req.tier_id))
    tier = tier_res.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Selected subscription tier not found")

    sub_res = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = sub_res.scalar_one_or_none()

    freq = (getattr(tier, "billing_frequency", "monthly") or "monthly").lower()
    days_map = {
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "bi-annual": 180,
        "annual": 365,
        "lifetime": 36500,
        "one-time": 36500,
        "trial": 14,
    }
    days = days_map.get(freq, 30)
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=days)

    if sub:
        sub.tier_id = req.tier_id
        sub.status = "active"
        sub.current_period_end = period_end
    else:
        sub = Subscription(
            id=str(uuid.uuid4()),
            user_id=user.id,
            tier_id=req.tier_id,
            status="active",
            current_period_end=period_end
        )
        db.add(sub)

    await db.commit()
    return await build_user_response(user, db)

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    user = result.scalar_one_or_none()
    if not user:
        # Prevent user enumeration in production, but let them know instructions sent
        return {"status": "success", "message": "If this email is registered, password recovery instructions have been sent."}
    
    if req.new_password:
        user.password_hash = hash_password(req.new_password)
        await db.commit()
        return {"status": "success", "message": "Password has been successfully updated. You can now log in."}
    
    return {"status": "success", "message": "Password reset link sent to registered email."}
