"""The stimulus set in stimuli/ is complete and study.json is valid."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.study import Study, load_study

STIMULI = Settings(_env_file=None).stimuli_dir


def test_study_json_is_valid_and_every_image_exists():
    study = load_study(STIMULI)
    assert study.missing_images(STIMULI) == []


def test_studied_frames_must_fit_the_morph():
    with pytest.raises(ValueError, match="studied_frames"):
        Study(frames=61, studied_frames=(15, 61), groups={"A": ["x"]})


def test_identities_must_be_unique_within_a_group():
    with pytest.raises(ValueError, match="twice"):
        Study(frames=61, studied_frames=(15, 45), groups={"A": ["x", "x"]})


def test_another_stimulus_set_needs_only_a_different_stimuli_folder(tmp_path, settings):
    """E.g. painful vs. non-painful faces: new folder + study.json, no code changes."""
    (tmp_path / "study.json").write_text(
        """{"faces_folder": "faces", "extension": ".png", "frames": 41,
            "ends": ["Neutral", "Pain"], "studied_frames": [10, 30],
            "groups": {"Painful": ["P1", "P2"], "Nonpainful": ["N1", "N2"]}}"""
    )
    settings.stimuli_dir = tmp_path
    with TestClient(create_app(settings)) as client:
        body = client.post(
            "/api/participants/init", json={"worker_id": "W1", "platform": "prolific"}
        ).json()
    assert body["design"]["groups"] == ["Painful", "Nonpainful"]
    assert body["design"]["ends"] == ["Neutral", "Pain"]
    assert {(t["group"], t["identity"]) for t in body["trials"]} == {
        ("Painful", "P1"),
        ("Painful", "P2"),
        ("Nonpainful", "N1"),
        ("Nonpainful", "N2"),
    }
    assert all(10 <= t["target_index"] <= 30 for t in body["trials"])
