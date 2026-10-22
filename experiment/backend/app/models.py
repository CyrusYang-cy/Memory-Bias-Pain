"""Database tables.

The table and column names match the original template so that existing databases
(including the production Postgres on Railway) keep working without a migration.
"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class ParticipantStatus(StrEnum):
    """Progress markers, written by the frontend as the participant moves through phases."""

    STARTED = "started"
    FINISHED_CONSENT = "working_finished_consent"
    FINISHED_ATTRITION = "working_finished_attrition"
    FINISHED_INSTRUCTIONS = "working_finished_instructions"
    FINISHED_TASK = "working_finished_task"
    FINISHED_SURVEY = "working_finished_survey"
    COMPLETE = "complete"
    TIMEOUT = "timeout"
    FAILED = "failed"

    @property
    def is_final(self) -> bool:
        """A participant in a final state may not start the experiment again."""
        return self in {self.COMPLETE, self.TIMEOUT, self.FAILED}


class Platform(StrEnum):
    PROLIFIC = "prolific"
    MTURK = "turk"
    CONNECT = "connect"
    SONA = "sona"


class Participant(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    anon_id: str | None = None
    worker_id: str | None = Field(default=None, index=True)
    hit_id: str | None = None  # Prolific STUDY_ID
    assignment_id: str | None = None  # Prolific SESSION_ID
    platform: str | None = None
    condition: str | None = None
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    start_time: datetime = Field(default_factory=utcnow, nullable=False)
    end_time: datetime | None = None
    status: str = Field(default=ParticipantStatus.STARTED)
    data_id: int | None = Field(default=None, foreign_key="data.id")


class Data(SQLModel, table=True):
    """One row per completed session: the full jsPsych data array."""

    id: int | None = Field(default=None, primary_key=True)
    worker_id: str | None = None
    condition: str | None = None
    json_data: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))


class Assignment(SQLModel, table=True):
    """One planned memory trial: which face (and which of its frames) a participant studies.

    Written when the participant opens the study, so a refresh gets the same plan and the
    server can balance how often each image is used across participants.
    """

    id: int | None = Field(default=None, primary_key=True)
    participant_id: int = Field(foreign_key="participant.id", index=True)
    trial_number: int  # position in the plan; presentation order is shuffled client-side
    trait_group: str  # a group in stimuli/study.json, e.g. "Dominant"
    identity: str
    target_index: int  # the studied frame (within study.json's studied_frames)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
