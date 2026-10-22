"""Which face image each participant studies, balanced across participants.

Each participant gets one trial per identity (every group in stimuli/study.json). Within a
group, the identities get different frames from `studied_frames` (e.g. 15–45): with as
many identities as frames (31 for 15–45), every frame is studied exactly once per group.
Which identity gets which frame favours the pairs used least often so far, so coverage
evens out as participants accumulate. Groups are planned independently.

"Used" counts assignments of participants who completed the study, or who are still in
progress and started less than `ABANDON_AFTER_MINUTES` ago. Abandoned sessions stop
counting, so their images get handed out again.

Each mode balances separately ("pools"): experiment sessions only against experiment
sessions, pilots against pilots, debug runs against debug runs. So piloting shows the
balancing at work without using up — or skewing — the real study's counts.
"""

import logging
import random
from collections import Counter
from datetime import timedelta

from sqlalchemy import func, or_, text
from sqlmodel import Session, select

from app.config import Settings
from app.matching import min_cost_assignment
from app.models import Assignment, Participant, ParticipantStatus, utcnow
from app.participants import CONDITION_BY_MODE
from app.study import load_study

logger = logging.getLogger(__name__)

# Arbitrary constant naming the Postgres advisory lock that serializes plan creation.
_PLAN_LOCK_ID = 7_260_121

Key = tuple[str, str, int]  # (trait_group, identity, target_index = studied frame)

_FINAL = [ParticipantStatus.COMPLETE, ParticipantStatus.TIMEOUT, ParticipantStatus.FAILED]

POOLS = tuple(CONDITION_BY_MODE)  # ("experiment", "pilot", "debug")
_SPECIAL = tuple(CONDITION_BY_MODE[p] for p in POOLS if p != "experiment")


def pool_of(participant: Participant) -> str:
    """Balancing pool of a participant, from their `condition` (legacy rows → experiment)."""
    for pool, condition in CONDITION_BY_MODE.items():
        if pool != "experiment" and participant.condition == condition:
            return pool
    return "experiment"


def _in_pool(pool: str):
    if pool == "experiment":
        return or_(Participant.condition.is_(None), Participant.condition.not_in(_SPECIAL))
    return Participant.condition == CONDITION_BY_MODE[pool]


def identities_for(settings: Settings) -> dict[str, list[str]]:
    """The identities used in the study: the first NUM_IDENTITIES of each group."""
    groups = load_study(settings.stimuli_dir).groups
    return {group: names[: settings.num_identities] for group, names in groups.items()}


def target_frames(settings: Settings) -> range:
    return load_study(settings.stimuli_dir).target_frames


def usage_counts(session: Session, settings: Settings, pool: str = "experiment") -> Counter[Key]:
    """How often each image has been assigned to participants of `pool` who still count."""
    cutoff = utcnow() - timedelta(minutes=settings.abandon_after_minutes)
    counted = or_(
        Participant.status == ParticipantStatus.COMPLETE,
        (Participant.status.not_in(_FINAL)) & (Participant.start_time >= cutoff),
    )
    return _counts(session, counted & _in_pool(pool))


def _counts(session: Session, where) -> Counter[Key]:
    rows = session.exec(
        select(Assignment.trait_group, Assignment.identity, Assignment.target_index, func.count())
        .join(Participant, Participant.id == Assignment.participant_id)
        .where(where)
        .group_by(Assignment.trait_group, Assignment.identity, Assignment.target_index)
    ).all()
    return Counter({(g, i, k): n for g, i, k, n in rows})


def get_or_create_plan(
    session: Session, participant: Participant, settings: Settings, rng: random.Random | None = None
) -> list[Assignment]:
    """The participant's trial plan; created (balanced) on first call, unchanged afterwards."""
    existing = _plan_of(session, participant)
    if existing:
        return existing

    rng = rng or random.Random()
    _lock(session)
    existing = _plan_of(session, participant)  # another request may have just created it
    if existing:
        return existing

    counts = usage_counts(session, settings, pool_of(participant))
    frames = target_frames(settings)
    plan: list[Assignment] = []
    for group, names in identities_for(settings).items():
        targets = _pick_targets(group, names, frames, counts, rng)
        for identity, target in zip(names, targets, strict=True):
            plan.append(
                Assignment(
                    participant_id=participant.id,
                    trial_number=len(plan) + 1,
                    trait_group=group,
                    identity=identity,
                    target_index=target,
                )
            )
    session.add_all(plan)
    session.commit()
    logger.info("Created a %d-trial plan for participant %s", len(plan), participant.worker_id)
    return _plan_of(session, participant)


def _pick_targets(
    group: str, names: list[str], frames: range, counts: Counter[Key], rng: random.Random
) -> list[int]:
    """One studied frame per identity of `group`, all different within the group.

    Among all ways to give the identities distinct frames, take one that uses each
    identity's least-used frames as much as possible; ties are broken at random.
    """
    if len(names) > len(frames):
        raise ValueError(
            f"{len(names)} {group} identities but only {len(frames)} studied frames: "
            "frames would repeat within the group"
        )
    # Usage dominates; the random part (< 1) only breaks ties between equally used frames.
    cost = [
        [counts[(group, identity, k)] * len(names) * 2 + rng.random() for k in frames]
        for identity in names
    ]
    return [frames[k] for k in min_cost_assignment(cost)]


def count_table(session: Session, settings: Settings, pool: str = "experiment") -> list[dict]:
    """Every (group, identity, frame) of `pool`: balancing count and total times assigned."""
    counted = usage_counts(session, settings, pool)
    total = _counts(session, _in_pool(pool))
    return [
        {
            "pool": pool,
            "group": group,
            "identity": identity,
            "target_index": k,
            "counted": counted[(group, identity, k)],
            "assigned_total": total[(group, identity, k)],
        }
        for group, names in identities_for(settings).items()
        for identity in names
        for k in target_frames(settings)
    ]


def _plan_of(session: Session, participant: Participant) -> list[Assignment]:
    return list(
        session.exec(
            select(Assignment)
            .where(Assignment.participant_id == participant.id)
            .order_by(Assignment.trial_number)
        ).all()
    )


def _lock(session: Session) -> None:
    """Serialize plan creation so simultaneous sign-ups see each other's assignments."""
    if session.get_bind().dialect.name == "postgresql":
        session.exec(text("SELECT pg_advisory_xact_lock(:id)").bindparams(id=_PLAN_LOCK_ID))
