# ResumeBuilder

Tailor a base resume to any job description, with a **transparent ATS-style score**
and ATS-safe DOCX/PDF export. Legally-safe by design: no scraping of gated job
platforms — discovery is via SerpApi, and job content is acquired by paste, upload,
or click-through.

See [BUILD_PLAN.md](BUILD_PLAN.md) for the full decision-locked spec.

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL + Redis + Celery
- **LLM**: OpenRouter (OpenAI-compatible), free OSS model, swappable via `OPENROUTER_MODEL`
- **Discovery**: SerpApi (Google Jobs)
- **Frontend**: Next.js (App Router) + TypeScript

## Quick start (Docker)

```bash
cp backend/.env.example backend/.env   # fill OPENROUTER_API_KEY, SERPAPI_KEY
docker compose up -d postgres redis
docker compose run --rm api alembic revision --autogenerate -m "initial"
docker compose run --rm api alembic upgrade head
docker compose up api worker
```

API at http://localhost:8000 (docs at `/docs`).

### Frontend

```bash
cd frontend
cp .env.local.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                            # http://localhost:3000
```

## Local dev without Docker

```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
# point DATABASE_URL at a local Postgres, then:
python -m scripts.init_db              # or use alembic once Postgres is reachable
uvicorn app.main:app --reload
```

## Tests

```bash
cd backend
.venv/Scripts/python -m pytest -q
```

Tests run against in-memory SQLite with the LLM and SerpApi adapters mocked — no
API keys or network needed.

## Pipeline

```
upload resume (+consent) → parse → structure (LLM)
job: paste / upload / SerpApi discover → JD requirements (LLM)
        → grounded tailored variant (LLM, provenance-required)
        → transparent ATS score (5 weighted components)
        → DOCX / PDF export (ATS-safe)
```

## Notes

- **PII**: resume content is sent to the configured (free) LLM, which may train on it.
  Consent is captured at upload. Swap `OPENROUTER_MODEL` to a no-training paid model
  before going to production.
- The tailor pipeline runs via FastAPI BackgroundTasks by default; switch the
  dispatch in `app/tailor/router.py` to `tailor_task.delay(...)` to use the Celery
  worker for scale-out.
