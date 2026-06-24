import io

import pytest

from app.llm.adapter import get_llm
from app.main import app as fastapi_app

RESUME_JSON = {
    "contact": {"name": "Alice", "email": "a@example.com", "phone": None,
                "location": "Bengaluru", "links": []},
    "summary": "Backend engineer.",
    "skills": ["Python", "FastAPI", "PostgreSQL"],
    "experience": [
        {"title": "Engineer", "company": "Acme", "location": "Remote",
         "start": "2021", "end": "2024",
         "bullets": ["Built APIs in FastAPI", "Optimized Postgres queries"]}
    ],
    "education": [{"degree": "BSc CS", "institution": "ABC", "year": "2020"}],
    "certifications": [], "projects": [],
}

JD_REQ = {
    "title": "Senior Python Backend Engineer",
    "seniority": "senior",
    "must_have_skills": ["python", "fastapi", "postgresql"],
    "nice_to_have_skills": ["aws"],
    "tools": ["docker"],
    "responsibilities": ["design apis", "own services"],
    "keywords": ["python", "fastapi", "postgresql", "aws", "docker"],
    "min_years_experience": 5,
}

VARIANT = {
    "summary": "Backend engineer specializing in Python, FastAPI and PostgreSQL.",
    "skills": ["Python", "FastAPI", "PostgreSQL", "AWS", "Docker"],
    "experience": [
        {"title": "Engineer", "company": "Acme", "start": "2021", "end": "2024", "bullets": [
            {"text": "Built scalable APIs in FastAPI serving 10000 req/s", "source_ids": ["e0b0"]},
            {"text": "Optimized PostgreSQL queries cutting latency 40%", "source_ids": ["e0b1"]},
        ]}
    ],
    "provenance_note": "All bullets derived from source resume.",
}


class FakeLLM:
    """Routes by system-prompt content to serve all three pipeline calls."""

    async def complete_json(self, system, user):
        s = system.lower()
        if "resume parser" in s:
            return RESUME_JSON
        if "hiring requirements" in s:
            return JD_REQ
        if "tailor a resume" in s:
            return VARIANT
        raise AssertionError("unexpected LLM call")

    async def complete(self, system, user, temperature=0.2):
        return "ok"


@pytest.fixture
def fake_llm():
    fastapi_app.dependency_overrides[get_llm] = lambda: FakeLLM()
    yield
    fastapi_app.dependency_overrides.pop(get_llm, None)


def setup_resume_and_job(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    tokens = client.post(
        "/auth/login", json={"email": "a@example.com", "password": "password123"}
    ).json()
    h = {"Authorization": f"Bearer {tokens['access_token']}"}
    client.post("/consents", headers=h)
    rid = client.post(
        "/resumes", headers=h,
        files={"file": ("r.txt", io.BytesIO(b"Alice resume text"), "text/plain")},
    ).json()["id"]
    jid = client.post(
        "/jds/paste", headers=h,
        json={"raw_text": "Senior Python Backend Engineer needs FastAPI and PostgreSQL skills."},
    ).json()["id"]
    return h, rid, jid


def test_tailor_run_completes_with_score(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)

    created = client.post("/tailor-runs", headers=h, json={"resume_id": rid, "job_id": jid})
    assert created.status_code == 202
    run_id = created.json()["id"]

    # Background task runs within the request in TestClient, so it should be done.
    detail = client.get(f"/tailor-runs/{run_id}", headers=h).json()
    assert detail["status"] == "done", detail.get("error")
    assert detail["variant"]["content_json"]["summary"]
    assert detail["score"]["overall"] > 80
    assert "evidence_grounding" in detail["score"]["breakdown"]


def test_score_endpoint_returns_breakdown(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    run_id = client.post(
        "/tailor-runs", headers=h, json={"resume_id": rid, "job_id": jid}
    ).json()["id"]
    variant_id = client.get(f"/tailor-runs/{run_id}", headers=h).json()["variant"]["id"]

    r = client.get(f"/scores/{variant_id}", headers=h)
    assert r.status_code == 200
    assert round(sum(r.json()["breakdown"].values()), 1) == r.json()["overall"]


def test_tailor_run_isolated_per_user(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    run_id = client.post(
        "/tailor-runs", headers=h, json={"resume_id": rid, "job_id": jid}
    ).json()["id"]

    client.post("/auth/register", json={"email": "b@example.com", "password": "password123"})
    t2 = client.post(
        "/auth/login", json={"email": "b@example.com", "password": "password123"}
    ).json()
    h2 = {"Authorization": f"Bearer {t2['access_token']}"}
    assert client.get(f"/tailor-runs/{run_id}", headers=h2).status_code == 404
