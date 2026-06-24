import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.audit import log_action
from app.common.db import utcnow
from app.common.errors import AppError, NotFoundError
from app.jobs import service as jobs_service
from app.llm.adapter import LLMAdapter
from app.llm.prompts import extract_jd_requirements, generate_variant, _GEN_V1_SYSTEM, _GEN_V2_SYSTEM
from app.resumes import service as resumes_service
from app.scoring.engine import score_variant
from app.tailor.models import ResumeVariant, Score, TailorRun


def create_run(
    db: Session, user_id: uuid.UUID, resume_id: uuid.UUID, job_id: uuid.UUID
) -> TailorRun:
    # Ownership checks (raise Forbidden/NotFound).
    resume = resumes_service.get_resume(db, user_id, resume_id)
    jobs_service.get_job(db, user_id, job_id)
    if resume.parse_status != "structured" or not resume.parsed_json:
        raise AppError(
            "Resume is not structured yet; cannot tailor.", code="resume_not_structured"
        )

    run = TailorRun(user_id=user_id, resume_id=resume_id, job_id=job_id, status="queued")
    db.add(run)
    db.commit()
    db.refresh(run)
    log_action(db, user_id, "tailor.run_created", "tailor_run", run.id)
    return run


def _set_status(db: Session, run: TailorRun, status: str) -> None:
    run.status = status
    db.add(run)
    db.commit()


async def process_run(run_id: uuid.UUID, llm: LLMAdapter) -> None:
    """Execute the tailor pipeline. Opens its own DB session (runs post-response)."""
    # Imported lazily so test fixtures can rebind SessionLocal to a shared test engine.
    from app.common.db import SessionLocal

    print(f"Starting process_run for run", run_id)
    db = SessionLocal()
    try:
        run = db.get(TailorRun, run_id)
        if run is None:
            print("Run not found")
            return
        print("Run found, status:", run.status)
        run.started_at = utcnow()
        _set_status(db, run, "extracting")
        print("Set status to extracting")

        resume = resumes_service.get_resume(db, run.user_id, run.resume_id)
        print("Got resume:", resume.id)
        jd = jobs_service.get_job_description(db, run.job_id)
        print("Got job description, parsed_json exists?", jd.parsed_json is not None)
        if jd is None:
            raise AppError("Job has no description to tailor against.", code="no_jd")

        # 1) JD requirement extraction (reuse cached parse if present)
        if not jd.parsed_json:
            print("Starting extract_jd_requirements, JD text length:", len(jd.raw_text))
            if len(jd.raw_text) < 100:
                print("JD too short, using fallback parsed json")
                jd.parsed_json = {
                    "title": None,
                    "seniority": None,
                    "must_have_skills": [],
                    "nice_to_have_skills": [],
                    "tools": [],
                    "responsibilities": [],
                    "keywords": [],
                    "min_years_experience": None
                }
            else:
                print("Calling extract_jd_requirements...")
                try:
                    jd.parsed_json = await extract_jd_requirements(llm, jd.raw_text)
                    print("extract_jd_requirements complete!")
                except Exception as e:
                    print("extract_jd_requirements failed, using fallback:", e)
                    jd.parsed_json = {
                        "title": None,
                        "seniority": None,
                        "must_have_skills": [],
                        "nice_to_have_skills": [],
                        "tools": [],
                        "responsibilities": [],
                        "keywords": [],
                        "min_years_experience": None
                    }
            db.add(jd)
            db.commit()
        jd_req = jd.parsed_json
        print("Using JD req:", jd_req)

        # 2) Generate two tailored variants
        _set_status(db, run, "generating")
        
        # Variant 1: Technical focus
        content1 = await generate_variant(llm, resume.parsed_json, jd_req, _GEN_V1_SYSTEM)
        variant1 = ResumeVariant(
            tailor_run_id=run.id,
            content_json=content1,
            provenance_json={"note": content1.get("provenance_note"), "type": "technical"},
        )
        db.add(variant1)
        
        # Variant 2: Experience focus
        content2 = await generate_variant(llm, resume.parsed_json, jd_req, _GEN_V2_SYSTEM)
        variant2 = ResumeVariant(
            tailor_run_id=run.id,
            content_json=content2,
            provenance_json={"note": content2.get("provenance_note"), "type": "experience"},
        )
        db.add(variant2)
        
        db.commit()
        db.refresh(variant1)
        db.refresh(variant2)

        # 3) Score both variants
        _set_status(db, run, "scoring")
        
        result1 = score_variant(content1, jd_req, resume.parsed_json)
        db.add(
            Score(
                variant_id=variant1.id,
                overall=result1.overall,
                breakdown_json=result1.breakdown,
                missing_keywords_json={"items": result1.missing_keywords},
                warnings_json={"items": result1.warnings},
            )
        )
        
        result2 = score_variant(content2, jd_req, resume.parsed_json)
        db.add(
            Score(
                variant_id=variant2.id,
                overall=result2.overall,
                breakdown_json=result2.breakdown,
                missing_keywords_json={"items": result2.missing_keywords},
                warnings_json={"items": result2.warnings},
            )
        )
        
        run.completed_at = utcnow()
        run.status = "done"
        db.add(run)
        db.commit()
        log_action(db, run.user_id, "tailor.run_done", "tailor_run", run.id,
                   {"overall1": result1.overall, "overall2": result2.overall})
    except Exception as exc:  # noqa: BLE001 — record failure, never crash the worker
        db.rollback()
        run = db.get(TailorRun, run_id)
        if run is not None:
            run.status = "failed"
            run.error = str(exc)[:1000]
            run.completed_at = utcnow()
            db.add(run)
            db.commit()
    finally:
        db.close()


def get_run(db: Session, user_id: uuid.UUID, run_id: uuid.UUID) -> TailorRun:
    run = db.get(TailorRun, run_id)
    if run is None or run.user_id != user_id:
        raise NotFoundError("Tailor run not found.")
    return run


def get_variants_for_run(db: Session, run_id: uuid.UUID) -> list[ResumeVariant]:
    return list(db.scalars(select(ResumeVariant).where(ResumeVariant.tailor_run_id == run_id)).all())

def get_variant_for_run(db: Session, run_id: uuid.UUID) -> ResumeVariant | None:
    return db.scalar(select(ResumeVariant).where(ResumeVariant.tailor_run_id == run_id))


def get_score_for_variant(db: Session, variant_id: uuid.UUID) -> Score | None:
    return db.scalar(select(Score).where(Score.variant_id == variant_id))


def get_variant_owned(db: Session, user_id: uuid.UUID, variant_id: uuid.UUID) -> ResumeVariant:
    variant = db.get(ResumeVariant, variant_id)
    if variant is None:
        raise NotFoundError("Variant not found.")
    run = db.get(TailorRun, variant.tailor_run_id)
    if run is None or run.user_id != user_id:
        raise NotFoundError("Variant not found.")
    return variant


def list_runs(db: Session, user_id: uuid.UUID) -> list[TailorRun]:
    return list(db.scalars(select(TailorRun).where(TailorRun.user_id == user_id).order_by(TailorRun.created_at.desc())).all())
