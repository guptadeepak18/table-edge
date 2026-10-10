import os
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from sqlalchemy import select, text
from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.models.user import User, Subscription, SubscriptionTier, TierConfig
from app.core.security import hash_password
import app.models.simulator
import app.models.tracker

from app.api.simulator import router as simulator_router
from app.api.tracker import router as tracker_router
from app.api.strategies import router as strategies_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and migrations
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        dialect_name = engine.dialect.name
        if dialect_name == "postgresql":
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notes VARCHAR(500);"))
                await conn.execute(text("ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS billing_frequency VARCHAR(50) DEFAULT 'monthly';"))
                await conn.execute(text("ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS model_type VARCHAR(50) DEFAULT 'subscription';"))
                await conn.execute(text("ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS description VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50);"))
            except Exception as e:
                print("Postgres column migration note:", e)
        else:
            def migrate_sqlite_tables(connection):
                try:
                    cursor = connection.connection.cursor()
                    cursor.execute("PRAGMA table_info(users)")
                    cols = [c[1] for c in cursor.fetchall()]
                    if "is_active" not in cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
                    if "role" not in cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'")
                    if "phone" not in cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(50)")
                    if "notes" not in cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN notes VARCHAR(500)")
                    
                    cursor.execute("PRAGMA table_info(subscription_tiers)")
                    tcols = [c[1] for c in cursor.fetchall()]
                    if "billing_frequency" not in tcols:
                        cursor.execute("ALTER TABLE subscription_tiers ADD COLUMN billing_frequency VARCHAR(50) DEFAULT 'monthly'")
                    if "model_type" not in tcols:
                        cursor.execute("ALTER TABLE subscription_tiers ADD COLUMN model_type VARCHAR(50) DEFAULT 'subscription'")
                    if "description" not in tcols:
                        cursor.execute("ALTER TABLE subscription_tiers ADD COLUMN description VARCHAR(255)")
                    if "badge_text" not in tcols:
                        cursor.execute("ALTER TABLE subscription_tiers ADD COLUMN badge_text VARCHAR(50)")
                    connection.connection.commit()
                except Exception as e:
                    print("SQLite schema migration note:", e)
            await conn.run_sync(migrate_sqlite_tables)

    # Seed default tiers and admin account if empty
    async with AsyncSessionLocal() as session:
        tier_res = await session.execute(select(SubscriptionTier))
        existing_tiers = tier_res.scalars().all()
        if not existing_tiers:
            free_tier = SubscriptionTier(id="tier-free", name="Free", price_cents=0, is_active=True)
            pro_tier = SubscriptionTier(id="tier-pro", name="Pro", price_cents=1299, is_active=True)
            session.add_all([free_tier, pro_tier])
            await session.flush()

            # Seed default tier configs per §7.2
            free_configs = [
                TierConfig(tier_id="tier-free", config_key="max_saved_strategies", config_value=1),
                TierConfig(tier_id="tier-free", config_key="max_backtest_sessions", config_value=100),
                TierConfig(tier_id="tier-free", config_key="can_access_module_b", config_value=False),
                TierConfig(tier_id="tier-free", config_key="can_use_racetrack", config_value=False),
            ]
            pro_configs = [
                TierConfig(tier_id="tier-pro", config_key="max_saved_strategies", config_value=999999),
                TierConfig(tier_id="tier-pro", config_key="max_backtest_sessions", config_value=50000),
                TierConfig(tier_id="tier-pro", config_key="can_access_module_b", config_value=True),
                TierConfig(tier_id="tier-pro", config_key="can_use_racetrack", config_value=True),
            ]
            session.add_all(free_configs + pro_configs)
            await session.commit()

        # Seed / Update Demo Admin User
        admin_email = "admin@tableedge.com"
        admin_res = await session.execute(select(User).where(User.email == admin_email))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_id = str(uuid.uuid4())
            admin_user = User(
                id=admin_id,
                email=admin_email,
                password_hash=hash_password("AdminPassword123!"),
                display_name="Administrator",
                role="admin",
                is_admin=True,
                is_active=True,
                phone="+1 (555) 019-2831",
                notes="Primary system superadministrator account seeded automatically.",
                created_at=datetime.now(timezone.utc)
            )
            session.add(admin_user)
            await session.flush()

            # Attach Pro subscription to admin
            admin_sub = Subscription(
                id=str(uuid.uuid4()),
                user_id=admin_user.id,
                tier_id="tier-pro",
                status="active"
            )
            session.add(admin_sub)
            await session.commit()
            print(f"[AUTH SEED] Admin user created: {admin_email}")
        else:
            # Update password and role to ensure admin login works
            admin_user.password_hash = hash_password("AdminPassword123!")
            admin_user.is_admin = True
            admin_user.role = "admin"
            admin_user.is_active = True
            if not admin_user.display_name:
                admin_user.display_name = "Administrator"
            await session.commit()
            print(f"[AUTH SEED] Admin user credentials verified: {admin_email}")

        # Seed initial custom condition options if table is empty
        try:
            from app.models.simulator import CustomConditionOption
            opt_res = await session.execute(select(CustomConditionOption))
            existing_opts = opt_res.scalars().all()
            if not existing_opts:
                seed_opts = [
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="trigger",
                        value="consecutive_losses",
                        label="Consecutive Losses",
                        description="Triggers when consecutive loss streak reaches N spins",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="trigger",
                        value="consecutive_wins",
                        label="Consecutive Wins",
                        description="Triggers when consecutive win streak reaches N spins",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="trigger",
                        value="drawdown_gte",
                        label="Session Drawdown ≥",
                        description="Triggers when drawdown from peak reaches monetary threshold",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="action",
                        value="double_multiplier",
                        label="Double Current Bet (2×)",
                        description="Multiplies active multiplier by 2",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="action",
                        value="triple_multiplier",
                        label="Triple Current Bet (3×)",
                        description="Multiplies active multiplier by 3",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="action",
                        value="half_multiplier",
                        label="Halve Current Bet (0.5×)",
                        description="Divides active multiplier by 2 (min 1.0×)",
                        created_by="system",
                    ),
                    CustomConditionOption(
                        id=str(uuid.uuid4()),
                        category="action",
                        value="stop_simulation",
                        label="Halt Session Early",
                        description="Immediately exits session and locks current balance",
                        created_by="system",
                    ),
                ]
                session.add_all(seed_opts)
                await session.commit()
                print(f"[CONDITION SEED] Seeded {len(seed_opts)} custom condition options")
        except Exception as e:
            print("Custom condition options seeding note:", e)

        # Seed default Casino Configuration if not present
        try:
            from app.models.tracker import CasinoConfig
            casino_res = await session.execute(select(CasinoConfig))
            existing_casinos = casino_res.scalars().all()
            if not existing_casinos:
                default_casino = CasinoConfig(
                    id=str(uuid.uuid4()),
                    name="Pragmatic Play Live (Default)",
                    casino_id="ppcdk00000003716",
                    provider="pragmatic",
                    is_default=True,
                    is_active=True,
                    notes="System default Pragmatic Play DGA live casino operator ID.",
                    created_at=datetime.now(timezone.utc)
                )
                session.add(default_casino)
                await session.commit()
                print(f"[CASINO SEED] Seeded default casino operator: {default_casino.casino_id}")
            else:
                # Ensure ppcdk00000003716 exists
                has_default = any(c.casino_id == "ppcdk00000003716" for c in existing_casinos)
                if not has_default:
                    default_casino = CasinoConfig(
                        id=str(uuid.uuid4()),
                        name="Pragmatic Play Live (Default)",
                        casino_id="ppcdk00000003716",
                        provider="pragmatic",
                        is_default=True,
                        is_active=True,
                        notes="System default Pragmatic Play DGA live casino operator ID.",
                        created_at=datetime.now(timezone.utc)
                    )
                    session.add(default_casino)
                    await session.commit()
                    print(f"[CASINO SEED] Seeded missing default casino operator: {default_casino.casino_id}")
        except Exception as e:
            print("Casino config seeding note:", e)

        # Autonomous 24/7 Pragmatic Live Feed Ingestion
        try:
            from app.services.pragmatic_feed import pragmatic_feed_service
            pragmatic_feed_service.set_casino_id("ppcdk00000003716")
            await pragmatic_feed_service.start()
            print("[FEED AUTOSTART] Autonomous Pragmatic live feed service started on server launch.")
        except Exception as e:
            print("Failed to auto-start Pragmatic feed service:", e)

    yield

    try:
        from app.services.pragmatic_feed import pragmatic_feed_service
        await pragmatic_feed_service.stop()
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(simulator_router, prefix=settings.API_V1_STR)
app.include_router(tracker_router, prefix=settings.API_V1_STR)
app.include_router(strategies_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ─── Frontend SPA Static Serving ─────────────────────────────────────────────
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
frontend_candidates = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"),
    os.path.join(backend_root, "frontend", "dist"),
]

frontend_dist = next(
    (p for p in frontend_candidates if os.path.isdir(p) and os.path.isfile(os.path.join(p, "index.html"))),
    None
)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def root():
        return {"status": "ok", "app": settings.PROJECT_NAME, "version": "1.0.0"}
