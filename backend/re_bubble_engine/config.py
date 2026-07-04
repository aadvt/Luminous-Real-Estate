from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    FRED_API_KEY: Optional[str] = None
    GEMINI_API_KEY: str
    GROQ_API_KEY: str
    OPENROUTER_API_KEY: str
    
    APP_ENV: str = "development"
    MACRO_REFRESH_INTERVAL_MINUTES: int = 4320
    AGENT_RUN_INTERVAL_MINUTES: int = 4320

    # Ingestion URLs
    WORLD_BANK_BASE_URL: str = "https://api.worldbank.org/v2"
    RBI_BASE_URL: str = "https://dbie.rbi.org.in/DBIE/dbie.rbi"
    NHB_RESIDEX_URL: str = "https://residex.nhbonline.org.in/"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
