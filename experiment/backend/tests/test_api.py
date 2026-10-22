from fastapi.testclient import TestClient

from app.config import Settings
from app.study import load_study

PROLIFIC = {"worker_id": "P1", "hit_id": "S1", "assignment_id": "X1", "platform": "prolific"}


def init(client: TestClient, **overrides):
    return client.post("/api/participants/init", json={**PROLIFIC, **overrides})


def test_init_returns_session_config(client: TestClient):
    res = init(client)
    assert res.status_code == 200
    body = res.json()
    assert body["participant"]["worker_id"] == "P1"
    assert body["participant"]["status"] == "started"
    design = body["design"]
    assert design["groups"] == ["Pain"]
    assert (design["frames"], design["studied_frames"]) == (61, [15, 45])
    study = load_study(Settings(_env_file=None).stimuli_dir)
    assert design["faces_url"] == f"/stimuli/{study.faces_folder}"
    assert len(body["trials"]) == 7  # One trial per pain identity.
    assert body["completion_redirect_url"] == "https://redirect.example/complete?cc=TEST"


def test_init_is_idempotent_until_complete(client: TestClient):
    first = init(client).json()["participant"]["anon_id"]
    assert init(client).json()["participant"]["anon_id"] == first  # resume after refresh

    client.post("/api/participants/P1/data", json={"json_data": [{"rt": 1}]})
    assert init(client).status_code == 403


def test_init_rejects_missing_worker_id(client: TestClient):
    assert init(client, worker_id="").status_code == 422


def test_sona_redirect_appends_credit_parameters(settings, client: TestClient):
    settings.redirect_url = "https://uiuc.sona-systems.com/webstudy_credit.aspx?"
    url = init(client, worker_id="12345", platform="sona").json()["completion_redirect_url"]
    assert url == (
        "https://uiuc.sona-systems.com/webstudy_credit.aspx?"
        "experiment_id=21&credit_token=tok&survey_code=12345"
    )


def test_other_platforms_use_redirect_url_as_is(client: TestClient):
    url = init(client, platform="turk").json()["completion_redirect_url"]
    assert url == "https://redirect.example/complete?cc=TEST"


def test_no_redirect_url_means_completion_code(settings, client: TestClient):
    settings.redirect_url = None
    assert init(client).json()["completion_redirect_url"] is None


def test_status_update(client: TestClient):
    init(client)
    res = client.patch("/api/participants/P1/status", json={"status": "working_finished_consent"})
    assert res.status_code == 204


def test_status_update_unknown_participant_is_404(client: TestClient):
    body = {"status": "working_finished_consent"}
    res = client.patch("/api/participants/nobody/status", json=body)
    assert res.status_code == 404


def test_status_update_rejects_unknown_status(client: TestClient):
    init(client)
    assert client.patch("/api/participants/P1/status", json={"status": "bogus"}).status_code == 422


def test_data_is_saved_and_participant_completed(client: TestClient):
    init(client)
    res = client.post(
        "/api/participants/P1/data",
        json={"condition": "Intermixed", "json_data": [{"trial_type": "x", "rt": 5}]},
    )
    assert res.status_code == 201

    auth = ("admin", "secret")
    participants = client.get("/api/admin/participants", auth=auth).json()
    assert participants[0]["status"] == "complete"
    assert participants[0]["data_id"] == res.json()["data_id"]
    assert client.get("/api/admin/status", auth=auth).json() == {"complete": 1}


def test_data_for_unknown_participant_is_still_saved(client: TestClient):
    res = client.post("/api/participants/ghost/data", json={"json_data": [{"rt": 1}]})
    assert res.status_code == 201


def test_admin_requires_credentials(client: TestClient):
    assert client.get("/api/admin/status").status_code == 401
    assert client.get("/api/admin/status", auth=("admin", "wrong")).status_code == 401


def test_root_redirect_keeps_query(client: TestClient):
    res = client.get("/?PROLIFIC_PID=abc", follow_redirects=False)
    assert res.headers["location"] == "/exp/?PROLIFIC_PID=abc"


def test_production_requires_admin_password():
    import pytest

    from app.config import Settings

    with pytest.raises(ValueError, match="ADMIN_PASSWORD"):
        Settings(_env_file=None, environment_type="production")


def test_postgres_urls_have_a_driver():
    """Railway gives a postgres URL; creating the engine must not fail on a missing driver."""
    from app.config import Settings
    from app.db import make_engine

    for url in ("postgresql://u:p@db.example:5432/railway", "postgres://u:p@db.example/railway"):
        engine = make_engine(Settings(_env_file=None, database_url=url).database_url)
        assert engine.dialect.name == "postgresql"


def test_pain_practice_and_wheel_mapping_are_saved(client: TestClient):
    from sqlmodel import Session, select
    from app.models import Data

    body = init(client, worker_id="pain-check", mode="pilot").json()
    assert body["design"]["practice_url"].endswith("square_to_circle")
    assert all(15 <= t["target_index"] <= 45 for t in body["trials"])
    rows = [dict(experiment_phase=phase, target_frame=30, response=60,
                 start_frame=10, slider_start_angle=137, slider_start_value=30,
                 response_angle=317, stimuli_seen=[10, 30, 60])
            for phase in ("practice", "main")]
    res = client.post("/api/participants/pain-check/data", json={"condition":"pilot", "json_data":rows})
    assert res.status_code == 201
    with Session(client.app.state.engine) as session:
        assert session.exec(select(Data).where(Data.worker_id == "pain-check")).one().json_data == rows
