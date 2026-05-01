from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Jarvis Prime API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://jarvis_prime:jarvis_prime@localhost:5432/jarvis_prime"
    jwt_secret_key: str = "change-me-in-local-env"
    jwt_algorithm: str = "HS256"
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
