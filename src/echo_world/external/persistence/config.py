from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+psycopg://echo_world:echo_world_local@localhost:54329/echo_world"
    )
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout_seconds: float = 5.0
    db_pool_recycle_seconds: int = 1800
    db_echo: bool = False

    openai_api_key: str = ""
    openai_generation_model: str = "gpt-5.4-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    llm_timeout_seconds: float = 20.0
    llm_mode: Literal["fake", "openai"] = "fake"

    app_env: str = "local"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
