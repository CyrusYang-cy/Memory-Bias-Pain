from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,  # never read the developer's .env in tests
        database_url="sqlite://",  # fresh in-memory database per test
        admin_username="admin",
        admin_password="secret",
        redirect_url="https://redirect.example/complete?cc=TEST",
        experiment_id="21",
        credit_token="tok",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
