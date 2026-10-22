"""Request/response bodies of the public API.

Keep in sync with `frontend/src/api/types.ts`.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models import ParticipantStatus, Platform


class ParticipantIn(BaseModel):
    worker_id: str = Field(min_length=1)
    hit_id: str | None = None
    assignment_id: str | None = None
    platform: Platform
    # experiment / pilot / debug; pilot and debug sessions don't count for image balancing.
    mode: Literal["experiment", "pilot", "debug"] = "experiment"


class ParticipantInfo(BaseModel):
    worker_id: str
    anon_id: str
    status: ParticipantStatus
    platform: Platform
    # experiment / pilot / debug; pilot and debug sessions don't count for image balancing.
    mode: Literal["experiment", "pilot", "debug"] = "experiment"


class ExperimentInfo(BaseModel):
    name: str
    title: str
    version_date: str
    estimated_task_duration: str
    compensation: str
    contact_email: str
    debug_mode: bool


class DesignInfo(BaseModel):
    """The stimulus set (from stimuli/study.json), as the frontend needs it."""

    num_identities: int
    groups: list[str]
    faces_url: str  # images at <faces_url>/<group>/<identity>/<frame><extension>
    extension: str
    frames: int
    ends: tuple[str, str]
    studied_frames: tuple[int, int]
    practice_url: str | None
    practice_frames: int


class TrialAssignment(BaseModel):
    """One planned memory trial (presentation order is shuffled by the frontend)."""

    group: str
    identity: str
    target_index: int  # the studied frame


class SessionConfig(BaseModel):
    """Everything the frontend needs to run one participant's session."""

    participant: ParticipantInfo
    experiment: ExperimentInfo
    design: DesignInfo
    trials: list[TrialAssignment]
    completion_redirect_url: str | None


class StatusUpdate(BaseModel):
    status: ParticipantStatus


class DataIn(BaseModel):
    condition: str | None = None
    json_data: list[dict[str, Any]]
