import os

# Force SQLite + a test secret before any app module (and its cached settings) imports.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["FILE_STORE_DIR"] = "./var/test_files"
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.common.db as db_module
from app.common.db import Base, get_db
from app.main import app as fastapi_app

# Import all models so create_all builds the full schema.
import app.models  # noqa: F401


@pytest.fixture
def db_engine():
    """Single shared in-memory SQLite engine, bound onto the app's db module so that
    both request-scoped sessions and background-task sessions hit the same DB."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    # Rebind the app's globals so SessionLocal() (used by background tasks) shares this DB.
    prev_engine, prev_session = db_module.engine, db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = TestingSession
    try:
        yield engine, TestingSession
    finally:
        db_module.engine, db_module.SessionLocal = prev_engine, prev_session
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_engine):
    _, TestingSession = db_engine

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()
