import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TailorRunCreate(BaseModel):
    resume_id: uuid.UUID
    job_id: uuid.UUID


class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    overall: float
    breakdown: dict
    missing_keywords: list[str] = []
    warnings: list[str] = []


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content_json: dict
    provenance_json: dict | None
    docx_key: str | None
    pdf_key: str | None
    created_at: datetime
    updated_at: datetime


class TailorRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resume_id: uuid.UUID
    job_id: uuid.UUID
    status: str
    error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TailorRunDetail(TailorRunOut):
    variants: list[VariantOut] = []
    scores: list[ScoreOut] = []
