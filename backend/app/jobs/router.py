import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select

from app.auth.deps import CurrentUser, DbSession
from app.jobs import service
from app.jobs.schemas import (
    DiscoverRequest,
    DiscoverResponse,
    JobDescriptionOut,
    JobOut,
    JobStubOut,
    JobWithJDOut,
    PasteJDRequest,
)
from app.resumes.parser import extract_text
from app.search.adapter import SearchAdapter, get_search

router = APIRouter(tags=["jobs"])


@router.post("/jds/paste", response_model=JobWithJDOut, status_code=201)
def paste_jd(payload: PasteJDRequest, user: CurrentUser, db: DbSession):
    job = service.create_job_from_text(
        db,
        user.id,
        raw_text=payload.raw_text,
        capture_mode="paste",
        title=payload.title,
        company=payload.company,
        url=payload.url,
    )
    return _job_with_jd(db, job)


@router.post("/jds/upload", response_model=JobWithJDOut, status_code=201)
async def upload_jd(
    user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
    title: Annotated[str | None, Form()] = None,
    company: Annotated[str | None, Form()] = None,
):
    data = await file.read()
    raw_text = extract_text(data, file.filename or "jd")
    job = service.create_job_from_text(
        db, user.id, raw_text=raw_text, capture_mode="upload", title=title, company=company
    )
    return _job_with_jd(db, job)


@router.post("/jobs/discover", response_model=DiscoverResponse)
async def discover(
    payload: DiscoverRequest,
    user: CurrentUser,
    search: Annotated[SearchAdapter, Depends(get_search)],
):
    from app.search.adapter import JobStub
    stubs: list[JobStub] = await search.discover(
        payload.query, payload.location, payload.top_k
    )
    # Convert JobStub dataclass to JobStubOut Pydantic model
    job_stub_outs = [JobStubOut(**stub.__dict__) for stub in stubs]
    return DiscoverResponse(jobs=job_stub_outs)


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(user: CurrentUser, db: DbSession):
    from app.jobs.models import Job
    jobs = db.execute(select(Job).where(Job.user_id == user.id).order_by(Job.created_at.desc())).scalars().all()
    return jobs

@router.get("/jobs/{job_id}", response_model=JobWithJDOut)
def get_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession):
    job = service.get_job(db, user.id, job_id)
    return _job_with_jd(db, job)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession):
    service.delete_job(db, user.id, job_id)


def _job_with_jd(db: DbSession, job) -> JobWithJDOut:
    jd = service.get_job_description(db, job.id)
    out = JobWithJDOut.model_validate(job)
    out.description = JobDescriptionOut.model_validate(jd) if jd else None
    return out
