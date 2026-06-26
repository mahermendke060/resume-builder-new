from functools import lru_cache
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Core ---
    app_name: str = "ResumeBuilder"
    environment: str = "development"
    debug: bool = True

    # --- Database / cache ---
    database_url: str = "postgresql+psycopg://resume:resume@localhost:5432/resume"
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth ---
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl: int = 900  # 15 min
    jwt_refresh_ttl: int = 1_209_600  # 14 days

    # --- LLM (OpenRouter) ---
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-chat-v3-0324:free"
    llm_timeout_seconds: float = 60.0

    # --- Search (SerpApi) ---
    serpapi_key: str = ""
    serpapi_base_url: str = "https://serpapi.com/search.json"

    # --- File storage ---
    file_store_dir: str = "./var/files"

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # --- Rate limiting ---
    rate_limit_enabled: bool = True
    rate_limit_default: str = "240/minute"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [i.strip() for i in v.split(",")]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()