import uuid
import asyncio
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends

from app.auth.deps import CurrentUser, DbSession
from app.llm.adapter import LLMAdapter, get_llm
from app.tailor import service
from app.tailor.schemas import (
    ScoreOut,
    TailorRunCreate,
    TailorRunDetail,
    TailorRunOut,
    VariantOut,
)

router = APIRouter(tags=["tailor"])


def run_async_process(run_id: uuid.UUID, llm: LLMAdapter) -> None:
    asyncio.run(service.process_run(run_id, llm))


@router.post("/tailor-runs", response_model=TailorRunOut, status_code=202)
def create_tailor_run(
    payload: TailorRunCreate,
    user: CurrentUser,
    db: DbSession,
    background: BackgroundTasks,
    llm: Annotated[LLMAdapter, Depends(get_llm)],
):
    run = service.create_run(db, user.id, payload.resume_id, payload.job_id)
    # v1 runs in-process via BackgroundTasks; swap to Celery dispatch to scale out.
    background.add_task(run_async_process, run.id, llm)
    return run


@router.get("/tailor-runs/{run_id}", response_model=TailorRunDetail)
def get_tailor_run(run_id: uuid.UUID, user: CurrentUser, db: DbSession):
    run = service.get_run(db, user.id, run_id)
    detail = TailorRunDetail.model_validate(run)

    variants = service.get_variants_for_run(db, run.id)
    for variant in variants:
        detail.variants.append(VariantOut.model_validate(variant))
        score = service.get_score_for_variant(db, variant.id)
        if score is not None:
            detail.scores.append(ScoreOut(
                overall=score.overall,
                breakdown=score.breakdown_json,
                missing_keywords=(score.missing_keywords_json or {}).get("items", []),
                warnings=(score.warnings_json or {}).get("items", []),
            ))
    return detail


@router.get("/scores/{variant_id}", response_model=ScoreOut)
def get_score(variant_id: uuid.UUID, user: CurrentUser, db: DbSession):
    variant = service.get_variant_owned(db, user.id, variant_id)
    score = service.get_score_for_variant(db, variant.id)
    if score is None:
        from app.common.errors import NotFoundError

        raise NotFoundError("Score not available for this variant.")
    return ScoreOut(
        overall=score.overall,
        breakdown=score.breakdown_json,
        missing_keywords=(score.missing_keywords_json or {}).get("items", []),
        warnings=(score.warnings_json or {}).get("items", []),
    )


@router.get("/tailor-runs", response_model=list[TailorRunDetail])
def list_tailor_runs(user: CurrentUser, db: DbSession):
    runs = service.list_runs(db, user.id)
    details = []
    for run in runs:
        detail = TailorRunDetail.model_validate(run)
        variants = service.get_variants_for_run(db, run.id)
        for variant in variants:
            detail.variants.append(VariantOut.model_validate(variant))
            score = service.get_score_for_variant(db, variant.id)
            if score is not None:
                detail.scores.append(ScoreOut(
                    overall=score.overall,
                    breakdown=score.breakdown_json,
                    missing_keywords=(score.missing_keywords_json or {}).get("items", []),
                    warnings=(score.warnings_json or {}).get("items", []),
                ))
        details.append(detail)
    return details
