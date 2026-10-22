"""Participant bookkeeping, independent of HTTP so it is easy to test."""

import logging
import uuid
from urllib.parse import urlencode

from sqlmodel import Session, select

from app.config import Settings
from app.models import Data, Participant, ParticipantStatus, Platform, utcnow
from app.schemas import ParticipantIn

logger = logging.getLogger(__name__)

# Stored in the `condition` column. The design is within-subject (both trait groups
# intermixed); pilot and debug sessions are marked so they can be filtered out of analyses,
# and each mode has its own image-balancing pool (see app/assignment.py).
CONDITION_BY_MODE = {"experiment": "Intermixed", "pilot": "pilot", "debug": "debug"}


class AlreadyParticipatedError(Exception):
    pass


class ParticipantNotFoundError(Exception):
    pass


def find_participant(session: Session, worker_id: str) -> Participant | None:
    return session.exec(select(Participant).where(Participant.worker_id == worker_id)).first()


def register(session: Session, info: ParticipantIn) -> Participant:
    """Create a participant, or return the existing one if they are resuming (e.g. refresh)."""
    existing = find_participant(session, info.worker_id)
    if existing is not None:
        if ParticipantStatus(existing.status).is_final:
            raise AlreadyParticipatedError(info.worker_id)
        logger.info("Participant %s resumed (status=%s)", info.worker_id, existing.status)
        return existing

    participant = Participant(
        anon_id=str(uuid.uuid4()),
        worker_id=info.worker_id,
        hit_id=info.hit_id,
        assignment_id=info.assignment_id,
        platform=info.platform,
        condition=CONDITION_BY_MODE[info.mode],
    )
    session.add(participant)
    session.commit()
    session.refresh(participant)
    logger.info("Participant %s registered via %s", info.worker_id, info.platform)
    return participant


def update_status(session: Session, worker_id: str, status: ParticipantStatus) -> Participant:
    participant = find_participant(session, worker_id)
    if participant is None:
        raise ParticipantNotFoundError(worker_id)
    if participant.status == ParticipantStatus.COMPLETE:
        logger.warning("Ignoring status %s for already-complete participant %s", status, worker_id)
        return participant

    participant.status = status
    session.add(participant)
    session.commit()
    session.refresh(participant)
    return participant


def save_data(
    session: Session, worker_id: str, json_data: list[dict], condition: str | None
) -> Data:
    """Store the session's data and mark the participant complete.

    Data is never dropped: if the participant row is missing (should not happen), one is
    created so the data stays linked to a worker id.
    """
    data = Data(worker_id=worker_id, condition=condition, json_data=json_data)
    session.add(data)
    session.flush()  # assigns data.id

    participant = find_participant(session, worker_id)
    if participant is None:
        logger.warning("Data received for unknown participant %s; creating a record", worker_id)
        participant = Participant(worker_id=worker_id, anon_id=str(uuid.uuid4()))

    participant.status = ParticipantStatus.COMPLETE
    participant.end_time = utcnow()
    participant.data_id = data.id
    participant.condition = condition or participant.condition
    session.add(participant)
    session.commit()
    session.refresh(data)
    logger.info("Saved %d trials for %s", len(json_data), worker_id)
    return data


def completion_redirect_url(settings: Settings, platform: Platform, worker_id: str) -> str | None:
    """Where to send the participant after the debriefing, or None to show a completion code."""
    if not settings.redirect_url:
        return None
    if platform == Platform.SONA:
        if not (settings.experiment_id and settings.credit_token):
            logger.error("SONA participant but EXPERIMENT_ID/CREDIT_TOKEN are unset")
            return None
        query = urlencode(
            {
                "experiment_id": settings.experiment_id,
                "credit_token": settings.credit_token,
                "survey_code": worker_id,
            }
        )
        return settings.redirect_url + query
    return settings.redirect_url
