def register(client, email="a@example.com", password="password123", name="Alice"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "name": name},
    )


def login(client, email="a@example.com", password="password123"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_success(client):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "a@example.com"
    assert "password" not in body and "password_hash" not in body


def test_register_duplicate_conflicts(client):
    register(client)
    r = register(client)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


def test_register_short_password_rejected(client):
    r = register(client, password="short")
    assert r.status_code == 422


def test_login_and_me_flow(client):
    register(client)
    r = login(client)
    assert r.status_code == 200
    tokens = r.json()
    assert tokens["token_type"] == "bearer"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "a@example.com"


def test_login_wrong_password(client):
    register(client)
    r = login(client, password="wrongpass123")
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_refresh_issues_new_access_token(client):
    register(client)
    tokens = login(client).json()
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_refresh_rejects_access_token(client):
    register(client)
    tokens = login(client).json()
    # Passing an access token where a refresh token is expected must fail.
    r = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401
