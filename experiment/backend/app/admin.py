"""Password-protected endpoints for monitoring data collection."""

import secrets
from collections import Counter
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlmodel import select

from app import assignment
from app.config import SettingsDep
from app.db import SessionDep
from app.models import Participant

security = HTTPBasic()


def require_admin(
    credentials: Annotated[HTTPBasicCredentials, Depends(security)], settings: SettingsDep
) -> str:
    ok_user = secrets.compare_digest(credentials.username, settings.admin_username)
    ok_pass = secrets.compare_digest(credentials.password, settings.admin_password)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/participants", response_model=list[Participant])
def list_participants(session: SessionDep):
    return session.exec(select(Participant)).all()


@router.get("/status")
def status_summary(session: SessionDep) -> dict[str, int]:
    """Number of participants in each status, e.g. how many have completed."""
    counts = Counter(session.exec(select(Participant.status)).all())
    return dict(sorted(counts.items()))


@router.get("/target-counts")
def target_counts(
    session: SessionDep,
    settings: SettingsDep,
    pool: Literal["experiment", "pilot", "debug"] = "experiment",
) -> list[dict]:
    """How often each image of each identity has been assigned, in one balancing pool.

    `counted` is what balancing uses (completed + recent in-progress sessions);
    `assigned_total` includes abandoned sessions. Use `?pool=pilot` for pilot sessions.
    """
    return assignment.count_table(session, settings, pool)
