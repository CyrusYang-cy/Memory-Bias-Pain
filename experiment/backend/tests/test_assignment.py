from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.config import Settings
from app.main import create_app
from app.models import Participant, ParticipantStatus
from app.study import load_study

FRAMES = load_study(Settings(_env_file=None).stimuli_dir).target_frames  # 15…45
N_FRAMES = len(FRAMES)


def make_client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


def init(client: TestClient, worker_id: str) -> dict:
    res = client.post(
        "/api/participants/init", json={"worker_id": worker_id, "platform": "prolific"}
    )
    assert res.status_code == 200, res.text
    return res.json()


def counts(client: TestClient) -> dict[tuple[str, str, int], int]:
    rows = client.get("/api/admin/target-counts", auth=("admin", "secret")).json()
    return {(r["group"], r["identity"], r["target_index"]): r["counted"] for r in rows}


def test_plan_has_one_trial_per_identity(client: TestClient):
    trials = init(client, "P1")["trials"]
    assert len(trials) == 7
    assert {t["group"] for t in trials} == {"Pain"}
    assert len({(t["group"], t["identity"]) for t in trials}) == 7
    assert all(t["target_index"] in FRAMES for t in trials)


def test_frames_do_not_repeat_within_a_participants_group(client: TestClient):
    for n in range(10):
        trials = init(client, f"P{n}")["trials"]
        for group in ("Pain",):
            targets = [t["target_index"] for t in trials if t["group"] == group]
            assert len(targets) == len(set(targets)) == 7
            assert set(targets) <= set(FRAMES)


def test_refresh_returns_the_same_plan(client: TestClient):
    assert init(client, "P1")["trials"] == init(client, "P1")["trials"]


@pytest.fixture
def small(settings: Settings) -> TestClient:
    settings.num_identities = 1  # one identity per group keeps the test fast
    with make_client(settings) as c:
        yield c


def test_balancing_uses_every_image_before_repeating(small: TestClient):
    for n in range(N_FRAMES):
        init(small, f"P{n}")
    c = counts(small)
    assert len(c) == N_FRAMES
    assert set(c.values()) == {1}  # every studied frame of the identity used once

    init(small, "extra")
    assert sorted(set(counts(small).values())) == [1, 2]


def test_abandoned_and_failed_sessions_stop_counting(small: TestClient, settings: Settings):
    for worker in ("done", "fresh", "stale", "failed"):
        init(small, worker)

    engine = small.app.state.engine
    with Session(engine) as session:
        by_worker = {p.worker_id: p for p in session.exec(select(Participant)).all()}
        by_worker["done"].status = ParticipantStatus.COMPLETE
        by_worker["done"].start_time -= timedelta(days=3)  # old but complete: still counts
        by_worker["stale"].start_time -= timedelta(minutes=settings.abandon_after_minutes + 1)
        by_worker["failed"].status = ParticipantStatus.FAILED
        session.add_all(by_worker.values())
        session.commit()

    rows = small.get("/api/admin/target-counts", auth=("admin", "secret")).json()
    assert sum(r["counted"] for r in rows) == 2  # "done" + "fresh", one trial each
    assert sum(r["assigned_total"] for r in rows) == 4


def test_each_mode_balances_in_its_own_pool(small: TestClient):
    auth = ("admin", "secret")

    def init_as(worker: str, mode: str) -> None:
        body = {"worker_id": worker, "platform": "prolific", "mode": mode}
        assert small.post("/api/participants/init", json=body).status_code == 200

    def counted(pool: str) -> dict:
        rows = small.get(f"/api/admin/target-counts?pool={pool}", auth=auth).json()
        return {(r["group"], r["identity"], r["target_index"]): r["counted"] for r in rows}

    init_as("real", "experiment")
    # Pilots are balanced among themselves: 31 pilots use every frame exactly once…
    for n in range(N_FRAMES):
        init_as(f"pilot{n}", "pilot")
    assert set(counted("pilot").values()) == {1}
    # …and leave the experiment pool untouched (only the one real session's one trial).
    assert sum(counted("experiment").values()) == 1
    init_as("dev1", "debug")
    assert sum(counted("debug").values()) == 1
    assert sum(counted("experiment").values()) == 1

    people = {
        p["worker_id"]: p["condition"]
        for p in small.get("/api/admin/participants", auth=auth).json()
    }
    assert (people["real"], people["pilot0"], people["dev1"]) == ("Intermixed", "pilot", "debug")
