from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

db_url = settings.DATABASE_URL or "sqlite+aiosqlite:///./table_edge.db"

# Format URL for asyncpg
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg expects 'ssl=require' or 'ssl=prefer' rather than 'sslmode=...'
if "sslmode=require" in db_url:
    db_url = db_url.replace("sslmode=require", "ssl=require")

connect_args = {}
if "sqlite" in db_url:
    connect_args["check_same_thread"] = False
elif "asyncpg" in db_url:
    connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
