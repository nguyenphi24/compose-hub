from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

_test_root = Path(tempfile.mkdtemp(prefix="composehub-tests-"))
_test_data_dir = _test_root / "data"

# These must be set before pytest imports app.main from individual test modules.
os.environ["COMPOSEHUB_DATA_DIR"] = str(_test_data_dir)
os.environ["COMPOSEHUB_DATABASE_URL"] = f"sqlite:///{_test_data_dir / 'composehub.db'}"

from app.database import Base, engine  # noqa: E402


@pytest.fixture(autouse=True)
def reset_test_database():
    """Give every test a fresh SQLite schema without touching repository data."""

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client(reset_test_database):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    shutil.rmtree(_test_root, ignore_errors=True)
