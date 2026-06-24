import pytest

from app.main import app as fastapi_app
from app.search.adapter import JobStub, get_search

JD_TEXT = (
    "We are hiring a Senior Python Backend Engineer. Requirements: Python, FastAPI, "
    "PostgreSQL, AWS, Docker. You will design APIs and own services end to end."
)


class FakeSearch:
    async def discover(self, query, location, top_k=5):
        stubs = [
            JobStub("serpapi", "ext1", "Senior Python Engineer", "Acme", "Bengaluru",
                    "https://example.com/1", "2 days ago", JD_TEXT),
            JobStub("serpapi", "ext2", "Backend Engineer", "Beta", "Remote",
                    "https://example.com/2", "1 day ago", "Backend role with Django and Redis."),
            # duplicate of first (same title/company/location) -> deduped
            JobStub("serpapi", "ext3", "Senior Python Engineer", "Acme", "Bengaluru",
                    "https://example.com/3", "3 days ago", JD_TEXT),
        ]
        return stubs[:top_k]


@pytest.fixture
def fake_search():
    fastapi_app.dependency_overrides[get_search] = lambda: FakeSearch()
    yield
    fastapi_app.dependency_overrides.pop(get_search, None)


def auth_headers(client, email="a@example.com"):
    client.post("/auth/register", json={"email": email, "password": "password123"})
    tokens = client.post("/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_paste_jd_creates_job_and_jd(client):
    headers = auth_headers(client)
    r = client.post("/jds/paste", headers=headers,
                    json={"raw_text": JD_TEXT, "title": "Senior Python", "company": "Acme"})
    assert r.status_code == 201
    body = r.json()
    assert body["source"] == "paste"
    assert body["description"]["capture_mode"] == "paste"
    assert body["description"]["quality_score"] > 0


def test_paste_jd_rejects_too_short(client):
    headers = auth_headers(client)
    r = client.post("/jds/paste", headers=headers, json={"raw_text": "too short"})
    assert r.status_code == 422


def test_discover_dedupes_and_stores(client, fake_search):
    headers = auth_headers(client)
    r = client.post("/jobs/discover", headers=headers,
                    json={"query": "python engineer", "location": "Bengaluru", "top_k": 5})
    assert r.status_code == 200
    body = r.json()
    # 3 stubs in, 1 is a duplicate -> 2 unique jobs
    assert len(body["jobs"]) == 2
    assert len(body["created_job_ids"]) == 2


def test_get_job_includes_jd(client, fake_search):
    headers = auth_headers(client)
    jid = client.post("/jobs/discover", headers=headers,
                      json={"query": "python", "location": None}).json()["jobs"][0]["id"]
    r = client.get(f"/jobs/{jid}", headers=headers)
    assert r.status_code == 200
    assert r.json()["description"]["raw_text"]


def test_cannot_access_other_users_job(client):
    h1 = auth_headers(client, "a@example.com")
    jid = client.post("/jds/paste", headers=h1, json={"raw_text": JD_TEXT}).json()["id"]
    h2 = auth_headers(client, "b@example.com")
    r = client.get(f"/jobs/{jid}", headers=h2)
    assert r.status_code == 403
