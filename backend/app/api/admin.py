import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.core.database import get_db
from app.models.user import User, Subscription, SubscriptionTier, TierConfig, TierConfigAuditLog
from app.models.tracker import CasinoConfig
from app.schemas.tracker import CasinoConfigCreate, CasinoConfigUpdate, CasinoConfigResponse
from app.core.security import hash_password, get_current_admin


router = APIRouter(prefix="/admin", tags=["admin"])

# --- Request Models ---

class TierConfigUpdate(BaseModel):
    changed_by_user_id: str
    config_key: str
    new_value: Any

class TierCreateOrUpdate(BaseModel):
    id: Optional[str] = None
    name: str
    price_cents: int = 0
    billing_frequency: str = "monthly"  # monthly, quarterly, annual, lifetime, weekly, one-time
    model_type: str = "subscription"    # freemium, subscription, lifetime, trial, experimental
    description: Optional[str] = None
    badge_text: Optional[str] = None
    is_active: bool = True
    configs: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None

class AdminUserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    role: str = "user"  # 'admin', 'user', 'manager'
    is_active: bool = True
    phone: Optional[str] = None
    notes: Optional[str] = None
    tier_id: str = "tier-free"

class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    tier_id: Optional[str] = None

class AdminUserStatusUpdate(BaseModel):
    is_active: bool

class AdminPasswordReset(BaseModel):
    new_password: str

class AuditLogItem(BaseModel):
    id: str
    tier_id: str
    changed_by: str
    old_value: Any
    new_value: Any
    changed_at: str


# --- Overview Stats ---

@router.get("/overview")
async def admin_overview(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    # Total users
    users_res = await db.execute(select(func.count(User.id)))
    total_users = users_res.scalar() or 0

    # Active vs suspended
    active_users_res = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users_res.scalar() or 0

    # Tiers count
    tiers_res = await db.execute(select(SubscriptionTier))
    all_tiers = tiers_res.scalars().all()

    # Subscriptions per tier
    tier_distribution = {}
    total_mrr_cents = 0
    sub_res = await db.execute(select(Subscription))
    all_subs = sub_res.scalars().all()
    tier_map = {t.id: t for t in all_tiers}

    for s in all_subs:
        t_name = tier_map[s.tier_id].name if s.tier_id in tier_map else s.tier_id
        tier_distribution[t_name] = tier_distribution.get(t_name, 0) + 1
        if s.status == "active" and s.tier_id in tier_map:
            total_mrr_cents += tier_map[s.tier_id].price_cents

    return {
        "total_users": total_users,
        "active_users": active_users,
        "suspended_users": total_users - active_users,
        "total_tiers": len(all_tiers),
        "total_subscriptions": len(all_subs),
        "estimated_mrr_dollars": round(total_mrr_cents / 100, 2),
        "tier_distribution": tier_distribution,
    }


# --- User Management Lifecycle ---

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    tiers_res = await db.execute(select(SubscriptionTier))
    tier_lookup = {t.id: t for t in tiers_res.scalars().all()}

    out = []
    for u in users:
        sub_res = await db.execute(select(Subscription).where(Subscription.user_id == u.id))
        sub = sub_res.scalar_one_or_none()
        tier_obj = tier_lookup.get(sub.tier_id) if (sub and sub.tier_id in tier_lookup) else None

        out.append({
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role or ("admin" if u.is_admin else "user"),
            "is_admin": bool(u.is_admin or u.role == "admin"),
            "is_active": bool(u.is_active),
            "phone": u.phone or "",
            "notes": u.notes or "",
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "subscription": {
                "tier_id": sub.tier_id if sub else "tier-free",
                "tier_name": tier_obj.name if tier_obj else "Free",
                "price_cents": tier_obj.price_cents if tier_obj else 0,
                "status": sub.status if sub else "active",
                "current_period_end": sub.current_period_end.isoformat() if (sub and sub.current_period_end) else None,
            }
        })
    return out

@router.post("/users")
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    existing = await db.execute(select(User).where(User.email == data.email.lower().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        id=str(uuid.uuid4()),
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.email.split("@")[0],
        role=data.role,
        is_admin=(data.role == "admin"),
        is_active=data.is_active,
        phone=data.phone,
        notes=data.notes,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    await db.flush()

    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=new_user.id,
        tier_id=data.tier_id,
        status="active"
    )
    db.add(sub)
    await db.commit()

    return {"status": "success", "user_id": new_user.id, "email": new_user.email}

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.email is not None:
        user.email = data.email.lower().strip()
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.role is not None:
        user.role = data.role
        user.is_admin = (data.role == "admin")
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.phone is not None:
        user.phone = data.phone
    if data.notes is not None:
        user.notes = data.notes

    if data.tier_id is not None:
        sub_res = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
        sub = sub_res.scalar_one_or_none()
        if sub:
            sub.tier_id = data.tier_id
        else:
            db.add(Subscription(
                id=str(uuid.uuid4()),
                user_id=user_id,
                tier_id=data.tier_id,
                status="active"
            ))

    await db.commit()
    return {"status": "success", "user_id": user_id}

@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    data: AdminUserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from suspending themselves
    if user.id == admin.id and not data.is_active:
        raise HTTPException(status_code=400, detail="Cannot suspend your own administrator account")

    user.is_active = data.is_active
    await db.commit()
    return {"status": "success", "user_id": user_id, "is_active": user.is_active}

@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    data: AdminPasswordReset,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"status": "success", "message": f"Password reset for {user.email}"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account")

    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete subscriptions first
    await db.execute(delete(Subscription).where(Subscription.user_id == user_id))
    await db.delete(user)
    await db.commit()
    return {"status": "success", "message": f"User {user.email} deleted"}


# --- Subscription Tiers & Freemium Management ---

@router.get("/tiers")
async def list_tiers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubscriptionTier))
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
            "is_active": t.is_active,
            "config": configs,
        })
    return out

@router.post("/tiers")
async def create_tier(
    data: TierCreateOrUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    tier_id = data.id or f"tier-{data.name.lower().replace(' ', '-')}"
    existing = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == tier_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tier with this ID already exists")

    new_tier = SubscriptionTier(
        id=tier_id,
        name=data.name,
        price_cents=data.price_cents,
        billing_frequency=data.billing_frequency,
        model_type=data.model_type,
        description=data.description,
        badge_text=data.badge_text,
        is_active=data.is_active
    )
    db.add(new_tier)

    cfg_dict = data.configs if data.configs is not None else data.config
    if cfg_dict:
        for k, v in cfg_dict.items():
            db.add(TierConfig(
                id=str(uuid.uuid4()),
                tier_id=tier_id,
                config_key=k,
                config_value=v
            ))

    # Audit log
    audit_entry = TierConfigAuditLog(
        id=str(uuid.uuid4()),
        tier_id=tier_id,
        changed_by=admin.id,
        old_value=None,
        new_value={
            "action": "create_tier",
            "name": data.name,
            "price_cents": data.price_cents,
            "billing_frequency": data.billing_frequency,
            "model_type": data.model_type
        }
    )
    db.add(audit_entry)
    await db.commit()

    return {"status": "success", "tier_id": tier_id}

@router.put("/tiers/{tier_id}")
async def update_tier(
    tier_id: str,
    data: TierCreateOrUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    res = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == tier_id))
    tier = res.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    old_info = {
        "name": tier.name,
        "price_cents": tier.price_cents,
        "billing_frequency": getattr(tier, "billing_frequency", "monthly"),
        "is_active": tier.is_active
    }
    tier.name = data.name
    tier.price_cents = data.price_cents
    tier.billing_frequency = data.billing_frequency
    tier.model_type = data.model_type
    tier.description = data.description
    tier.badge_text = data.badge_text
    tier.is_active = data.is_active

    cfg_dict = data.configs if data.configs is not None else data.config
    if cfg_dict is not None:
        # Replace tier configs with updated set
        await db.execute(delete(TierConfig).where(TierConfig.tier_id == tier_id))
        for k, v in cfg_dict.items():
            db.add(TierConfig(
                id=str(uuid.uuid4()),
                tier_id=tier_id,
                config_key=k,
                config_value=v
            ))

    audit_entry = TierConfigAuditLog(
        id=str(uuid.uuid4()),
        tier_id=tier_id,
        changed_by=admin.id,
        old_value=old_info,
        new_value={
            "name": data.name,
            "price_cents": data.price_cents,
            "billing_frequency": data.billing_frequency,
            "is_active": data.is_active
        }
    )
    db.add(audit_entry)
    await db.commit()

    return {"status": "success", "tier_id": tier_id}

@router.delete("/tiers/{tier_id}")
async def delete_tier(
    tier_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    if tier_id in ["tier-free"]:
        raise HTTPException(status_code=400, detail="Cannot delete the default Free tier")

    res = await db.execute(select(SubscriptionTier).where(SubscriptionTier.id == tier_id))
    tier = res.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    # Migrate any active users on this tier to free tier so they are not orphaned
    subs_res = await db.execute(select(Subscription).where(Subscription.tier_id == tier_id))
    for s in subs_res.scalars().all():
        s.tier_id = "tier-free"

    # Delete tier configs
    await db.execute(delete(TierConfig).where(TierConfig.tier_id == tier_id))
    await db.delete(tier)

    # Audit log
    audit_entry = TierConfigAuditLog(
        id=str(uuid.uuid4()),
        tier_id=tier_id,
        changed_by=admin.id,
        old_value={"name": tier.name, "price_cents": tier.price_cents},
        new_value={"action": "delete_tier", "tier_id": tier_id}
    )
    db.add(audit_entry)
    await db.commit()

    return {"status": "success", "message": f"Tier {tier.name} deleted successfully"}

@router.put("/tiers/{tier_id}/config")
async def update_tier_config(
    tier_id: str,
    update: TierConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    cfg_res = await db.execute(
        select(TierConfig).where(
            TierConfig.tier_id == tier_id,
            TierConfig.config_key == update.config_key
        )
    )
    cfg = cfg_res.scalar_one_or_none()
    old_val = cfg.config_value if cfg else None

    if cfg:
        cfg.config_value = update.new_value
    else:
        cfg = TierConfig(
            id=str(uuid.uuid4()),
            tier_id=tier_id,
            config_key=update.config_key,
            config_value=update.new_value,
        )
        db.add(cfg)

    audit_entry = TierConfigAuditLog(
        id=str(uuid.uuid4()),
        tier_id=tier_id,
        changed_by=admin.id,
        old_value=old_val,
        new_value=update.new_value,
    )
    db.add(audit_entry)
    await db.commit()

    return {"status": "success", "tier_id": tier_id, "key": update.config_key, "value": update.new_value}

@router.get("/audit-logs", response_model=List[AuditLogItem])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(TierConfigAuditLog).order_by(TierConfigAuditLog.changed_at.desc()).limit(100))
    logs = result.scalars().all()
    return [
        AuditLogItem(
            id=l.id,
            tier_id=l.tier_id,
            changed_by=l.changed_by,
            old_value=l.old_value,
            new_value=l.new_value,
            changed_at=l.changed_at.isoformat(),
        )
        for l in logs
    ]

# --- Casino Operators & Feed Configs ---

@router.get("/casinos", response_model=List[CasinoConfigResponse])
async def list_casino_configs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(CasinoConfig).order_by(CasinoConfig.is_default.desc(), CasinoConfig.created_at.asc()))
    casinos = result.scalars().all()
    return [
        CasinoConfigResponse(
            id=c.id,
            name=c.name,
            casino_id=c.casino_id,
            provider=c.provider or "pragmatic",
            is_default=bool(c.is_default),
            is_active=bool(c.is_active),
            notes=c.notes,
            created_at=c.created_at.isoformat() if c.created_at else datetime.now(timezone.utc).isoformat(),
        )
        for c in casinos
    ]

@router.post("/casinos", response_model=CasinoConfigResponse)
async def create_casino_config(
    payload: CasinoConfigCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    if payload.is_default:
        all_res = await db.execute(select(CasinoConfig))
        for existing in all_res.scalars().all():
            existing.is_default = False

    new_casino = CasinoConfig(
        id=str(uuid.uuid4()),
        name=payload.name,
        casino_id=payload.casino_id.strip(),
        provider=payload.provider or "pragmatic",
        is_default=payload.is_default,
        is_active=payload.is_active,
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_casino)
    await db.commit()
    await db.refresh(new_casino)
    return CasinoConfigResponse(
        id=new_casino.id,
        name=new_casino.name,
        casino_id=new_casino.casino_id,
        provider=new_casino.provider,
        is_default=new_casino.is_default,
        is_active=new_casino.is_active,
        notes=new_casino.notes,
        created_at=new_casino.created_at.isoformat(),
    )

@router.put("/casinos/{id}", response_model=CasinoConfigResponse)
async def update_casino_config(
    id: str,
    payload: CasinoConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(CasinoConfig).where(CasinoConfig.id == id))
    casino = result.scalar_one_or_none()
    if not casino:
        raise HTTPException(status_code=404, detail="Casino configuration not found")

    if payload.is_default:
        all_res = await db.execute(select(CasinoConfig))
        for existing in all_res.scalars().all():
            existing.is_default = False

    if payload.name is not None:
        casino.name = payload.name
    if payload.casino_id is not None:
        casino.casino_id = payload.casino_id.strip()
    if payload.provider is not None:
        casino.provider = payload.provider
    if payload.is_default is not None:
        casino.is_default = payload.is_default
    if payload.is_active is not None:
        casino.is_active = payload.is_active
    if payload.notes is not None:
        casino.notes = payload.notes

    await db.commit()
    await db.refresh(casino)
    return CasinoConfigResponse(
        id=casino.id,
        name=casino.name,
        casino_id=casino.casino_id,
        provider=casino.provider,
        is_default=casino.is_default,
        is_active=casino.is_active,
        notes=casino.notes,
        created_at=casino.created_at.isoformat() if casino.created_at else datetime.now(timezone.utc).isoformat(),
    )

@router.delete("/casinos/{id}")
async def delete_casino_config(
    id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(CasinoConfig).where(CasinoConfig.id == id))
    casino = result.scalar_one_or_none()
    if not casino:
        raise HTTPException(status_code=404, detail="Casino configuration not found")
    
    await db.delete(casino)
    await db.commit()
    return {"status": "deleted", "id": id}

@router.put("/casinos/{id}/default")
async def set_default_casino(
    id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(CasinoConfig).where(CasinoConfig.id == id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Casino configuration not found")

    all_res = await db.execute(select(CasinoConfig))
    for c in all_res.scalars().all():
        c.is_default = (c.id == id)
    
    await db.commit()
    return {"status": "success", "default_casino_id": target.casino_id}

