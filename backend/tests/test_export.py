from tests.test_tailor import FakeLLM, fake_llm, setup_resume_and_job  # noqa: F401


def _make_variant(client, h, rid, jid):
    run_id = client.post(
        "/tailor-runs", headers=h, json={"resume_id": rid, "job_id": jid}
    ).json()["id"]
    return client.get(f"/tailor-runs/{run_id}", headers=h).json()["variant"]["id"]


def test_export_docx_then_download(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    vid = _make_variant(client, h, rid, jid)

    r = client.post(f"/variants/{vid}/export", headers=h, json={"format": "docx"})
    assert r.status_code == 200
    assert r.json()["format"] == "docx"

    dl = client.get(f"/variants/{vid}/file", headers=h, params={"format": "docx"})
    assert dl.status_code == 200
    # DOCX is a zip archive -> starts with PK
    assert dl.content[:2] == b"PK"
    assert "attachment" in dl.headers["content-disposition"]


def test_export_pdf(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    vid = _make_variant(client, h, rid, jid)

    r = client.post(f"/variants/{vid}/export", headers=h, json={"format": "pdf"})
    assert r.status_code == 200

    dl = client.get(f"/variants/{vid}/file", headers=h, params={"format": "pdf"})
    assert dl.status_code == 200
    assert dl.content[:4] == b"%PDF"


def test_download_before_export_404(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    vid = _make_variant(client, h, rid, jid)
    r = client.get(f"/variants/{vid}/file", headers=h, params={"format": "pdf"})
    assert r.status_code == 404


def test_bad_format_rejected(client, fake_llm):
    h, rid, jid = setup_resume_and_job(client)
    vid = _make_variant(client, h, rid, jid)
    r = client.post(f"/variants/{vid}/export", headers=h, json={"format": "rtf"})
    assert r.status_code == 400
