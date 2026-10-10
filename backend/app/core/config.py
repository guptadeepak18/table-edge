from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "TableEdge"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "table-edge-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Aiven or PostgreSQL Database URL
    DATABASE_URL: Optional[str] = "sqlite+aiosqlite:///./table_edge.db"
    
    # Stripe billing test mode
    STRIPE_SECRET_KEY: Optional[str] = "mock_stripe_key"
    STRIPE_WEBHOOK_SECRET: Optional[str] = "mock_webhook_secret"
    # AI Provider Keys
    OPENROUTER_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
