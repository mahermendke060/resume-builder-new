import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.audit import log_action
from app.common.errors import ForbiddenError, NotFoundError
from app.llm.adapter import LLMAdapter, LLMError
from app.llm.prompts import structure_resume
from app.resumes.models import Consent, Resume
from app.resumes.parser import extract_text, suffix_for

AI_CONSENT = "ai_processing"


def record_consent(db: Session, user_id: uuid.UUID, kind: str = AI_CONSENT) -> Consent:
    consent = Consent(user_id=user_id, kind=kind)
    db.add(consent)
    db.commit()
    db.refresh(consent)
    log_action(db, user_id, "consent.granted", "consent", consent.id, {"kind": kind})
    return consent


def has_consent(db: Session, user_id: uuid.UUID, kind: str = AI_CONSENT) -> bool:
    return (
        db.scalar(
            select(Consent.id).where(Consent.user_id == user_id, Consent.kind == kind).limit(1)
        )
        is not None
    )


def add_snippet_ids(parsed: dict) -> dict:
    """Annotate experience/project bullets with stable ids for provenance tracking."""
    for ei, exp in enumerate(parsed.get("experience", []) or []):
        bullets = exp.get("bullets", []) or []
        exp["bullets"] = [{"id": f"e{ei}b{bi}", "text": b} if isinstance(b, str) else b
                          for bi, b in enumerate(bullets)]
    for pi, proj in enumerate(parsed.get("projects", []) or []):
        bullets = proj.get("bullets", []) or []
        proj["bullets"] = [{"id": f"p{pi}b{bi}", "text": b} if isinstance(b, str) else b
                           for bi, b in enumerate(bullets)]
    return parsed


def set_active_resume(db: Session, user_id: uuid.UUID, resume_id: uuid.UUID) -> Resume:
    """Set a resume as the active (primary) one, deactivating all others for the user."""
    # Deactivate all other resumes for this user
    db.query(Resume).filter(Resume.user_id == user_id).update({"active": False})
    # Activate the target resume
    resume = db.get(Resume, resume_id)
    if resume is None:
        raise NotFoundError("Resume not found")
    if resume.user_id != user_id:
        raise ForbiddenError("You do not have access to this resume")
    resume.active = True
    db.commit()
    db.refresh(resume)
    log_action(db, user_id, "resume.set_active", "resume", resume_id)
    return resume


async def create_resume(
    db: Session,
    user_id: uuid.UUID,
    *,
    filename: str,
    data: bytes,
    llm: LLMAdapter,
    storage,
) -> Resume:
    raw_text = extract_text(data, filename)
    key = storage.save_bytes(data, suffix=suffix_for(filename), subdir="resumes")

    # Check if this is the user's first resume - if so, make it active!
    existing_resumes = db.query(Resume).filter(Resume.user_id == user_id).count()
    is_active = existing_resumes == 0

    resume = Resume(
        user_id=user_id,
        filename=filename,
        source_file_key=key,
        raw_text=raw_text,
        parse_status="raw_only",
        active=is_active,
    )

    # Best-effort LLM structuring; never block upload on model availability.
    try:
        parsed = await structure_resume(llm, raw_text)
        resume.parsed_json = add_snippet_ids(parsed)
        resume.parse_status = "structured"
    except (LLMError, ValueError):
        # If we can't structure it, don't save it at all!
        print("Could not structure resume, not saving it...")
        # Clean up the stored file too
        storage.delete(key)
        raise AppError(
            "Could not parse resume. Please upload a clear, text-based resume.",
            code="parse_failed"
        )

    db.add(resume)
    db.commit()
    db.refresh(resume)
    log_action(db, user_id, "resume.uploaded", "resume", resume.id,
               {"parse_status": resume.parse_status})
    return resume


def get_resume(db: Session, user_id: uuid.UUID, resume_id: uuid.UUID) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None:
        raise NotFoundError("Resume not found.")
    if resume.user_id != user_id:
        raise ForbiddenError("You do not have access to this resume.")
    return resume


def list_resumes(db: Session, user_id: uuid.UUID) -> list[Resume]:
    return list(
        db.scalars(
            select(Resume).where(Resume.user_id == user_id, Resume.parse_status == "structured").order_by(Resume.created_at.desc())
        )
    )
