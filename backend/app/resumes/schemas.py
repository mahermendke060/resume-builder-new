import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConsentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    version: str
    created_at: datetime


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str | None
    parse_status: str
    parsed_json: dict | None
    active: bool
    created_at: datetime


class ResumeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str | None
    parse_status: str
    active: bool
    created_at: datetime
