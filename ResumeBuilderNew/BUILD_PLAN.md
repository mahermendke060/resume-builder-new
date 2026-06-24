# ResumeBuilder — v1 Build Plan (Milestone 1 MVP)

> Decision-locked specification. Build from this. Anything not listed under
> **In scope** is explicitly deferred (see §11).

---

## 1. Scope & locked decisions

The MVP is a **legally-safe resume-tailoring tool**: a user uploads a base
resume, supplies a job description (paste / file / SerpApi discovery), and gets
back a tailored resume variant with a transparent ATS-style score and a
DOCX/PDF export. No scraping of gated platforms. No payments yet.

| Area | Decision |
|---|---|
| Frontend | Next.js (React, App Router) + TypeScript |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2.0 |
| DB | PostgreSQL |
| Async/cache | Redis + Celery (worker only; no Beat yet) |
| LLM | OpenRouter (OpenAI-compatible API), **free OSS model everywhere**, model id = env config, behind one `LLMAdapter` |
| PII | **Consent disclosure required at resume upload** (free models may train on data) |
| Discovery | **SerpApi only** (Google Jobs engine) — no LinkedIn/Indeed fetching |
| Acquisition | Manual-first: paste JD / upload JD file / click-through SerpApi result |
| Payments | **Deferred** — entitlement seam present, no gateway |
| Export | DOCX + PDF, ATS-safe (no tables/text-boxes/headers in body) |

### In scope (Milestone 1)
- Email/password auth (JWT access + refresh)
- Resume upload (PDF/DOCX) → parse → canonical sections
- JD intake: paste text, upload file, or SerpApi discovery (Top-5 stubs)
- LLM requirement extraction from JD
- LLM grounded tailored-resume generation (provenance-required)
- Transparent ATS scoring engine (5 components, explainable)
- DOCX + PDF export
- Background processing via Celery for the tailor pipeline
- Consent capture + audit log

### Explicitly deferred (§11)
Payments, scheduler/saved searches, pgvector/embeddings + career vault,
browser extension capture, partner/official APIs, OCR, multi-tenant org features.

---

## 2. Architecture

Modular **FastAPI monolith** — internal modules, not separate services. Celery
runs the one long pipeline (parse → extract → generate → score). Everything
synchronous and fast goes through the API directly.

```
Next.js (React)
      │  REST + JWT
      ▼
FastAPI app
 ├─ auth/            JWT, register/login/refresh
 ├─ resumes/         upload, parse, store canonical sections
 ├─ jds/             paste / upload / SerpApi discovery → normalized JD
 ├─ tailor/          orchestrates pipeline, returns run id
 ├─ scoring/         transparent ATS engine (pure functions)
 ├─ export/          DOCX + PDF rendering
 ├─ llm/             LLMAdapter (OpenRouter)
 ├─ search/          SearchAdapter (SerpApi)
 ├─ common/          db, config, security, audit, errors
 └─ workers/         Celery tasks (the pipeline)
      │
      ├─ PostgreSQL  (source of truth)
      ├─ Redis       (Celery broker/result + rate control)
      └─ Object/file store (local disk in dev, S3-compatible later)
```

**Pipeline (Celery chain):**
```
parse_resume → extract_jd_requirements → generate_variant → score_variant → render_exports
```
The API enqueues the chain and returns a `tailor_run_id`; the frontend polls
`GET /tailor-runs/{id}` for status + results.

---

## 3. Tech stack (pin at install time)

**Backend**
- Python 3.12
- fastapi, uvicorn[standard]
- pydantic v2, pydantic-settings
- sqlalchemy 2.0, alembic, psycopg[binary]
- celery, redis
- httpx (LLM + SerpApi calls, async)
- python-jose[cryptography] (JWT), passlib[bcrypt] (hashing)
- python-docx (DOCX), weasyprint **or** reportlab (PDF)
- pypdf + docx2txt (resume text extraction; no pyresparser — it's abandoned)
- slowapi (rate limiting)
- pytest, pytest-asyncio

**Frontend**
- Next.js (App Router) + TypeScript
- TanStack Query (server state / polling), Zod (response validation)
- Tailwind CSS + a component lib (shadcn/ui)

**Infra (dev)**
- docker-compose: `api`, `worker`, `postgres`, `redis`

---

## 4. Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email (uniq), password_hash, status, created_at | auth principal |
| `user_profiles` | user_id, name, target_roles[], locations[], prefs_json | preferences |
| `consents` | id, user_id, kind, granted_at, version | `kind='ai_processing'` gates upload |
| `resumes` | id, user_id, source_file_url, raw_text, parsed_json, active | parsed canonical sections |
| `jobs` | id, user_id, source, external_id, url, title, company, location, posted_at | normalized stub (SerpApi/manual) |
| `job_descriptions` | id, job_id, raw_text, parsed_json, capture_mode, quality_score | one canonical JD per job |
| `tailor_runs` | id, user_id, resume_id, job_id, status, error, started_at, completed_at | orchestration entry |
| `resume_variants` | id, tailor_run_id, content_json, provenance_json, docx_url, pdf_url, status | tailored output + evidence map |
| `scores` | id, variant_id, overall, breakdown_json, missing_keywords_json, warnings_json | explainable score |
| `audit_logs` | id, user_id, action, entity_type, entity_id, meta_json, created_at | traceability |

`status` enums: `tailor_runs` → `queued|parsing|extracting|generating|scoring|rendering|done|failed`.
`capture_mode` → `paste|upload|serpapi`.
`provenance_json`: each generated bullet → list of source snippet ids from `resumes.parsed_json`.

---

## 5. API contract

All routes JWT-protected except auth + health. JSON unless noted.

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | liveness |
| `/auth/register` | POST | create account |
| `/auth/login` | POST | issue access+refresh |
| `/auth/refresh` | POST | rotate access token |
| `/consents` | POST | record `ai_processing` consent |
| `/profiles/me` | GET / PATCH | profile + preferences |
| `/resumes` | POST (multipart) | upload base resume (requires active consent) |
| `/resumes/{id}` | GET | parsed resume + metadata |
| `/jds/paste` | POST | create job+JD from pasted text |
| `/jds/upload` | POST (multipart) | create job+JD from file |
| `/jobs/discover` | POST | SerpApi Google Jobs search → Top-5 stubs |
| `/jobs/{id}` | GET | normalized job + JD |
| `/tailor-runs` | POST | start tailor pipeline `{resume_id, job_id}` → run id |
| `/tailor-runs/{id}` | GET | status + variant + score (poll target) |
| `/variants/{id}/export` | POST | `{format: docx\|pdf}` → signed download url |
| `/scores/{variant_id}` | GET | score breakdown |

**Sample payloads**

```jsonc
// POST /jobs/discover
{ "query": "Senior Python Backend Engineer", "location": "Bengaluru, India", "top_k": 5 }

// POST /tailor-runs
{ "resume_id": "res_123", "job_id": "job_1" }

// GET /tailor-runs/run_9  (when done)
{
  "run_id": "run_9", "status": "done",
  "variant_id": "var_789",
  "score": {
    "overall": 78,
    "breakdown": { "format": 18, "keywords": 22, "skills_alignment": 14,
                   "semantic_fit": 16, "evidence_grounding": 8 },
    "missing_keywords": ["Kafka", "Terraform"],
    "warnings": ["Two bullets appear overly generic"]
  }
}
```

---

## 6. LLMAdapter (OpenRouter)

Single module wrapping OpenRouter's OpenAI-compatible `/chat/completions`.

```python
class LLMAdapter:
    def __init__(self, api_key, base_url="https://openrouter.ai/api/v1",
                 model=settings.OPENROUTER_MODEL): ...
    async def complete(self, system: str, user: str,
                       json_schema: dict | None = None,
                       max_retries: int = 3) -> dict: ...
```

- **Model is env config** (`OPENROUTER_MODEL`), never hard-coded.
- **Structured output**: request JSON; validate against Pydantic; on parse
  failure, retry with a repair prompt (free models are inconsistent at JSON).
- **Rate-limit aware**: respect 429s with backoff; free models are throttled.
- **Grounding contract** for generation: prompt must require every generated
  bullet to cite source snippet ids; reject/flag unsupported claims before render.

Two logical call sites (same adapter, same model in v1):
1. `extract_jd_requirements(jd_text) -> {skills[], tools[], seniority, must_haves[], nice_to_haves[]}`
2. `generate_variant(resume_sections, jd_requirements) -> {sections, provenance}`

---

## 7. SearchAdapter (SerpApi)

```python
class SearchAdapter:
    async def discover(self, query, location, top_k=5) -> list[JobStub]: ...
```
- Uses SerpApi **google_jobs** engine. Returns stubs `{title, company, location,
  url, external_id, posted_at, snippet}`.
- Dedupe by canonical url + normalized (title, company, city).
- **No server-side fetch of LinkedIn/Indeed pages.** Discovery returns stubs; the
  user clicks through or pastes the JD. Provider is swappable behind this interface.

---

## 8. Transparent ATS scoring engine

Pure, deterministic functions over `(resume_variant, jd_requirements)`. No
external model needed for scoring — explainable by construction. Weighted sum to 100:

| Component | Weight | Signal |
|---|---|---|
| Format / readability | 20 | section headers present, chronology clear, no risky tables/headers, parseable |
| Keyword coverage | 25 | share of JD must-have nouns/skills present in variant |
| Skills alignment | 20 | normalized extracted-skill overlap (synonym-mapped) |
| Semantic fit | 20 | similarity of JD vs variant summary/experience (v1: token/TF-IDF overlap; embeddings deferred) |
| Evidence grounding | 15 | fraction of bullets with valid provenance; penalize ungrounded |

Output: `overall`, per-component `breakdown`, `missing_keywords`, `warnings`
(keyword stuffing, inconsistent dates, generic bullets). Every number traceable
to an input — this is the product's trust differentiator.

> Note: v1 "semantic fit" is lexical (TF-IDF/overlap) to avoid the embeddings
> stack. Swap to Sentence-Transformers/pgvector later behind the same function.

---

## 9. Project structure

```
ResumeBuilderNew/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ common/        config.py, db.py, security.py, audit.py, errors.py
│  │  ├─ auth/          router.py, service.py, schemas.py
│  │  ├─ resumes/       router.py, parser.py, service.py, schemas.py
│  │  ├─ jds/           router.py, service.py, schemas.py
│  │  ├─ jobs/          router.py, service.py, schemas.py
│  │  ├─ tailor/        router.py, service.py, schemas.py
│  │  ├─ scoring/       engine.py, schemas.py
│  │  ├─ export/        docx.py, pdf.py
│  │  ├─ llm/           adapter.py, prompts.py, schemas.py
│  │  ├─ search/        adapter.py, schemas.py
│  │  └─ workers/       celery_app.py, pipeline.py
│  ├─ alembic/
│  ├─ tests/
│  ├─ pyproject.toml
│  └─ Dockerfile
├─ frontend/            (Next.js app)
├─ docker-compose.yml
└─ BUILD_PLAN.md
```

---

## 10. Build sequence (Milestone 1)

Ordered so each step is independently testable. ~3–4 weeks for one strong
full-stack dev.

1. **Foundation** — repo, docker-compose (postgres/redis), FastAPI skeleton,
   config via pydantic-settings, `/health`, Alembic init.
2. **Auth** — users table, register/login/refresh, JWT, password hashing,
   `get_current_user` dependency. Tests.
3. **Consent + resume upload** — consent record gate, multipart upload, file
   store, `resumes.raw_text` via pypdf/docx2txt.
4. **Resume parsing** — LLM (or rules) → canonical `parsed_json` sections.
5. **JD intake** — paste + upload endpoints → `jobs` + `job_descriptions`.
6. **LLMAdapter** — OpenRouter client, JSON-mode + repair retry, `extract_jd_requirements`.
7. **SearchAdapter** — SerpApi google_jobs → `/jobs/discover` Top-5.
8. **Tailor pipeline** — Celery chain, `tailor_runs` status machine,
   `generate_variant` with provenance.
9. **Scoring engine** — 5-component transparent score + warnings.
10. **Export** — DOCX (python-docx) + PDF, ATS-safe layout, signed download.
11. **Frontend** — Next.js: auth, upload+consent, JD intake/discovery, run +
    poll, score view, download. (Built against the OpenAPI contract.)
12. **Hardening** — slowapi rate limits, audit logging, error envelope,
    pytest + FastAPI TestClient coverage on the pipeline.

---

## 11. Deferred (do NOT build in v1)

- Payments / subscriptions / webhooks — leave an entitlement check seam only.
- Scheduler, saved searches, recurring runs (add Celery Beat later).
- pgvector / embeddings / Sentence-Transformers / career vault.
- Browser extension / share-tab capture.
- LinkedIn / Indeed / Naukri scraping or partner APIs.
- OCR for image JDs.
- Multi-tenant / org / admin-provider controls.

---

## 12. Config (env vars)

```
# backend
DATABASE_URL=postgresql+psycopg://...
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=...
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=1209600
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=<free-oss-model-id>     # swappable; e.g. a free DeepSeek/Qwen/Llama variant
SERPAPI_KEY=...
FILE_STORE_DIR=./var/files               # S3 later
```

---

## 13. Risks carried from review

- **Free-model JSON reliability** → repair-retry + Pydantic validation (mitigated in §6).
- **Free-model PII training** → consent disclosure required (mitigated in §1/§4).
- **SerpApi single dependency + cost** → isolated behind SearchAdapter; watch cost-per-search.
- **ATS-safe export is the real hard part** → constrain templates early, test against a parser.
- **No eval loop yet** → add a small golden-set quality check before scaling generation.
```
