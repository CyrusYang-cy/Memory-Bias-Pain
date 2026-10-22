"""Public endpoints called by the experiment frontend."""

from fastapi import APIRouter, HTTPException, Request, status

from app import assignment, participants
from app.config import Settings, SettingsDep
from app.db import SessionDep
from app.models import ParticipantStatus, Platform
from app.schemas import (
    DataIn,
    DesignInfo,
    ExperimentInfo,
    ParticipantIn,
    ParticipantInfo,
    SessionConfig,
    StatusUpdate,
    TrialAssignment,
)
from app.study import load_study

router = APIRouter(prefix="/api", tags=["experiment"])


def design_info(settings: Settings) -> DesignInfo:
    study = load_study(settings.stimuli_dir)
    return DesignInfo(
        num_identities=settings.num_identities,
        groups=list(study.groups),
        faces_url=f"/stimuli/{study.faces_folder}",
        extension=study.extension,
        frames=study.frames,
        ends=study.ends,
        studied_frames=study.studied_frames,
        practice_url=f"/stimuli/{study.practice.folder}" if study.practice else None,
        practice_frames=study.practice.frames if study.practice else 0,
    )


@router.post("/participants/init", response_model=SessionConfig)
def init_participant(body: ParticipantIn, session: SessionDep, settings: SettingsDep):
    """Register (or resume) a participant and return the session configuration."""
    try:
        participant = participants.register(session, body)
    except participants.AlreadyParticipatedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Sorry! Looks like you've participated in this study before."
        ) from None
    plan = assignment.get_or_create_plan(session, participant, settings)

    return SessionConfig(
        participant=ParticipantInfo(
            worker_id=body.worker_id,
            anon_id=participant.anon_id or "",
            status=ParticipantStatus(participant.status),
            platform=body.platform,
        ),
        experiment=ExperimentInfo(
            name=settings.experiment_name,
            title=settings.experiment_title,
            version_date=settings.version_date,
            estimated_task_duration=settings.estimated_task_duration,
            compensation=settings.compensation,
            contact_email=settings.contact_email,
            debug_mode=settings.debug_mode,
        ),
        design=design_info(settings),
        trials=[
            TrialAssignment(group=a.trait_group, identity=a.identity, target_index=a.target_index)
            for a in plan
        ],
        completion_redirect_url=participants.completion_redirect_url(
            settings, Platform(body.platform), body.worker_id
        ),
    )


@router.patch("/participants/{worker_id}/status", status_code=status.HTTP_204_NO_CONTENT)
def update_status(worker_id: str, body: StatusUpdate, session: SessionDep):
    try:
        participants.update_status(session, worker_id, body.status)
    except participants.ParticipantNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown participant {worker_id}") from None


@router.post("/participants/{worker_id}/data", status_code=status.HTTP_201_CREATED)
def save_data(worker_id: str, body: DataIn, session: SessionDep) -> dict[str, int]:
    data = participants.save_data(session, worker_id, body.json_data, body.condition)
    return {"data_id": data.id or 0}


@router.get("/ip")
def client_ip(request: Request) -> str:
    return request.client.host if request.client else ""
