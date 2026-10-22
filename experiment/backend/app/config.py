"""All runtime configuration, read from environment variables or the repo-root `.env`.

Every setting here can be overridden by an environment variable with the same name in
upper case (e.g. `NUM_IDENTITIES=30`). See `.env.example` for a documented template.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, Request
from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_URL = f"sqlite:///{REPO_ROOT / 'pain.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        extra="ignore",  # tolerate legacy keys still present in old .env files
    )

    # --- Server -------------------------------------------------------------------------
    environment_type: Literal["debug", "production"] = "debug"
    # The server uses DATABASE_URL (Railway's internal address). DATABASE_PUBLIC_URL is only a
    # fallback here; the CLI prefers it, because a laptop can't reach the internal address.
    database_url: str = Field(
        default=DEFAULT_SQLITE_URL,
        validation_alias=AliasChoices("DATABASE_URL", "DATABASE_PUBLIC_URL"),
    )
    database_echo: bool = False
    admin_username: str = "admin"
    admin_password: str = "change-me"
    frontend_dist_dir: Path = REPO_ROOT / "frontend" / "dist"
    stimuli_dir: Path = REPO_ROOT / "stimuli"  # images + study.json (see app/study.py)

    # --- Experiment (sent to the frontend) ----------------------------------------------
    debug_mode: bool = False  # True: the frontend shows the data instead of saving it
    experiment_name: str = "memory_bias_pain"
    experiment_title: str = "Face memory study"
    version_date: str = "2026-10-16"
    estimated_task_duration: str = "15 minutes"
    compensation: str = "$3.00"
    contact_email: str = "cy36@illinois.edu"
    # Identities per group (the first N listed in stimuli/study.json); capped at the number
    # listed. Pain has seven identities in one group: seven trials per participant.
    num_identities: int = Field(default=7, ge=1)
    # An unfinished session stops counting toward image balancing after this long.
    abandon_after_minutes: int = Field(default=120, ge=1)

    # --- Completion redirect --------------------------------------------------------------
    # Where participants go after the debriefing. For SONA participants the credit
    # parameters are appended (so REDIRECT_URL should end with "?"); everyone else is sent
    # to REDIRECT_URL as is. Unset: participants are shown a completion code instead.
    redirect_url: str | None = None
    experiment_id: str | None = None  # SONA only
    credit_token: str | None = None  # SONA only

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: str | None) -> str:
        # Unresolved Railway references (e.g. "${Postgres.DATABASE_URL}") arrive empty locally.
        if not value or "${" in value:
            return DEFAULT_SQLITE_URL
        # SQLAlchemy only accepts the "postgresql://" scheme.
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value

    @field_validator("redirect_url", "experiment_id", "credit_token", mode="before")
    @classmethod
    def _empty_to_none(cls, value: object) -> str | None:
        return str(value) if value not in (None, "") else None

    @model_validator(mode="after")
    def _require_real_admin_password(self) -> "Settings":
        if self.environment_type == "production" and self.admin_password == "change-me":
            raise ValueError("Set ADMIN_PASSWORD when ENVIRONMENT_TYPE=production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment_type == "production"


@lru_cache
def load_settings() -> Settings:
    """Settings from the environment; used at startup and by the CLI."""
    return Settings()


def get_settings(request: Request) -> Settings:
    """Request dependency: the settings the running app was created with."""
    return request.app.state.settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
