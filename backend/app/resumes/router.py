import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.auth.deps import CurrentUser, DbSession
from app.common import storage
from app.common.errors import ForbiddenError
from app.llm.adapter import LLMAdapter, get_llm
from app.resumes import service
from app.resumes.models import Resume
from app.resumes.schemas import ConsentOut, ResumeOut, ResumeSummary

router = APIRouter(tags=["resumes"])

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/consents", response_model=ConsentOut, status_code=201)
def grant_consent(user: CurrentUser, db: DbSession):
    return service.record_consent(db, user.id)


@router.post("/resumes", response_model=ResumeOut, status_code=201)
async def upload_resume(
    user: CurrentUser,
    db: DbSession,
    llm: Annotated[LLMAdapter, Depends(get_llm)],
    file: Annotated[UploadFile, File()],
):
    print("=== Upload resume ===")
    print(f"User: {user.id}")
    print(f"Filename: {file.filename}")
    if not service.has_consent(db, user.id):
        print("ERROR: No consent")
        raise ForbiddenError(
            "AI-processing consent required before uploading a resume. POST /consents first."
        )
    data = await file.read()
    print(f"Data size: {len(data)} bytes")
    if len(data) > MAX_RESUME_BYTES:
        print("ERROR: Too big")
        raise ForbiddenError("Resume exceeds the 5 MB size limit.")
    
    print("Calling create_resume...")
    try:
        resume = await service.create_resume(
            db,
            user.id,
            filename=file.filename or "resume",
            data=data,
            llm=llm,
            storage=storage,
        )
        print("Resume created!")
        return resume
    except Exception as e:
        print(f"ERROR in create_resume: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise


@router.get("/resumes", response_model=list[ResumeSummary])
def list_resumes(user: CurrentUser, db: DbSession) -> list[Resume]:
    return service.list_resumes(db, user.id)


@router.put("/resumes/{resume_id}/active", response_model=ResumeOut)
def set_active_resume(resume_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Resume:
    return service.set_active_resume(db, user.id, resume_id)


@router.get("/resumes/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Resume:
    return service.get_resume(db, user.id, resume_id)
