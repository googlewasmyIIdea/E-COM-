from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        extra="ignore",
    )
    database_url: str = ""
    postgres_user: str = ""
    postgres_password: str = ""
    postgres_db: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = Field(default=5432, ge=1, le=65535)

    @model_validator(mode="after")
    def compose_database_url(self) -> Self:
        if not self.database_url and self.postgres_user and self.postgres_db:
            self.database_url = URL.create(
                "postgresql+asyncpg",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            ).render_as_string(hide_password=False)
        return self

    database_schema: str = Field(default="", pattern=r"^$|^[a-z][a-z0-9_]{0,62}$")
    cors_origins: str = ""
    session_hours: int = Field(default=8, ge=1, le=168)
    reservation_minutes: int = Field(default=15, ge=1, le=60)
    app_origin: str = "http://localhost:3000"
    public_api_url: str = "http://localhost:8000"
    mail_dir: str = str(Path(__file__).resolve().parents[3] / ".mailbox")
    upload_dir: str = str(Path(__file__).resolve().parents[3] / "media")
    smtp_host: str = ""
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    email_from: str = "Paper & Petal <hello@paperandpetal.local>"
    payment_environment: str = "sandbox"
    khalti_secret_key: str = ""
    esewa_secret_key: str = ""
    esewa_product_code: str = ""
    enable_email_verification: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
