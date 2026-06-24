import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.audit import log_action
from app.common.errors import ForbiddenError, NotFoundError
from app.jobs.models import Job, JobDescription
from app.search.adapter import JobStub, SearchAdapter


def _quality_score(text: str) -> float:
    """Cheap heuristic: longer, structured JDs score higher (0..1)."""
    n = len(text)
    return min(1.0, round(n / 1500.0, 3))


def create_job_from_text(
    db: Session,
    user_id: uuid.UUID,
    *,
    raw_text: str,
    capture_mode: str,
    title: str | None = None,
    company: str | None = None,
    url: str | None = None,
) -> Job:
    job = Job(
        user_id=user_id,
        source=capture_mode,
        title=title,
        company=company,
        url=url,
    )
    db.add(job)
    db.flush()  # assign job.id

    jd = JobDescription(
        job_id=job.id,
        raw_text=raw_text,
        capture_mode=capture_mode,
        quality_score=_quality_score(raw_text),
    )
    db.add(jd)
    db.commit()
    db.refresh(job)
    log_action(db, user_id, "jd.created", "job", job.id, {"capture_mode": capture_mode})
    return job


async def discover_jobs(
    db: Session,
    user_id: uuid.UUID,
    search: SearchAdapter,
    *,
    query: str,
    location: str | None,
    top_k: int,
) -> list[Job]:
    stubs: list[JobStub] = await search.discover(query, location, top_k)
    jobs: list[Job] = []
    seen: set[tuple] = set()
    for stub in stubs:
        key = (
            (stub.title or "").strip().lower(),
            (stub.company or "").strip().lower(),
            (stub.location or "").strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        job = Job(
            user_id=user_id,
            source=stub.source,
            external_id=stub.external_id,
            url=stub.url,
            title=stub.title,
            company=stub.company,
            location=stub.location,
            posted_at=stub.posted_at,
        )
        db.add(job)
        db.flush()
        if stub.snippet:
            db.add(
                JobDescription(
                    job_id=job.id,
                    raw_text=stub.snippet,
                    capture_mode="serpapi",
                    quality_score=_quality_score(stub.snippet),
                )
            )
        jobs.append(job)
    db.commit()
    for job in jobs:
        db.refresh(job)
    log_action(db, user_id, "jobs.discovered", "job", None, {"count": len(jobs), "query": query})
    return jobs


def get_job(db: Session, user_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError("Job not found.")
    if job.user_id != user_id:
        raise ForbiddenError("You do not have access to this job.")
    return job


def get_job_description(db: Session, job_id: uuid.UUID) -> JobDescription | None:
    return db.scalar(select(JobDescription).where(JobDescription.job_id == job_id))


def delete_job(db: Session, user_id: uuid.UUID, job_id: uuid.UUID) -> None:
    job = get_job(db, user_id, job_id)
    db.delete(job)
    db.commit()
