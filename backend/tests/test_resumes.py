import io

import pytest

from app.llm.adapter import get_llm
from app.main import app as fastapi_app

SAMPLE_RESUME_JSON = {
    "contact": {"name": "Alice Dev", "email": "a@example.com", "phone": None,
                "location": "Bengaluru", "links": []},
    "summary": "Backend engineer.",
    "skills": ["Python", "FastAPI", "PostgreSQL"],
    "experience": [
        {"title": "Engineer", "company": "Acme", "location": "Remote",
         "start": "2021", "end": "2024",
         "bullets": ["Built APIs in FastAPI", "Optimized Postgres queries"]}
    ],
    "education": [{"degree": "BSc CS", "institution": "ABC", "year": "2020"}],
    "certifications": [],
    "projects": [],
}


class FakeLLM:
    async def complete_json(self, system, user):
        return SAMPLE_RESUME_JSON

    async def complete(self, system, user, temperature=0.2):
        return "ok"


@pytest.fixture
def fake_llm():
    fastapi_app.dependency_overrides[get_llm] = lambda: FakeLLM()
    yield
    fastapi_app.dependency_overrides.pop(get_llm, None)


def auth_headers(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    tokens = client.post(
        "/auth/login", json={"email": "a@example.com", "password": "password123"}
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def upload(client, headers, text="John Doe\nSkills: Python", name="resume.txt"):
    return client.post(
        "/resumes",
        headers=headers,
        files={"file": (name, io.BytesIO(text.encode()), "text/plain")},
    )


def test_upload_blocked_without_consent(client, fake_llm):
    headers = auth_headers(client)
    r = upload(client, headers)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_upload_structures_resume_with_consent(client, fake_llm):
    headers = auth_headers(client)
    assert client.post("/consents", headers=headers).status_code == 201

    r = upload(client, headers)
    assert r.status_code == 201
    body = r.json()
    assert body["parse_status"] == "structured"
    # snippet ids were annotated onto experience bullets
    first_bullet = body["parsed_json"]["experience"][0]["bullets"][0]
    assert first_bullet["id"] == "e0b0"
    assert "FastAPI" in first_bullet["text"]


def test_get_and_list_resume(client, fake_llm):
    headers = auth_headers(client)
    client.post("/consents", headers=headers)
    rid = upload(client, headers).json()["id"]

    got = client.get(f"/resumes/{rid}", headers=headers)
    assert got.status_code == 200
    assert got.json()["id"] == rid

    listed = client.get("/resumes", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_cannot_access_other_users_resume(client, fake_llm):
    h1 = auth_headers(client)
    client.post("/consents", headers=h1)
    rid = upload(client, h1).json()["id"]

    client.post("/auth/register", json={"email": "b@example.com", "password": "password123"})
    t2 = client.post(
        "/auth/login", json={"email": "b@example.com", "password": "password123"}
    ).json()
    h2 = {"Authorization": f"Bearer {t2['access_token']}"}

    r = client.get(f"/resumes/{rid}", headers=h2)
    assert r.status_code == 403


def test_unsupported_file_type_rejected(client, fake_llm):
    headers = auth_headers(client)
    client.post("/consents", headers=headers)
    r = upload(client, headers, name="resume.exe")
    assert r.status_code == 415
