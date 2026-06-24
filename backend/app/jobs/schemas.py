import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PasteJDRequest(BaseModel):
    raw_text: str = Field(min_length=20)
    title: str | None = None
    company: str | None = None
    url: str | None = None


class DiscoverRequest(BaseModel):
    query: str = Field(min_length=2)
    location: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class JobStubOut(BaseModel):
    source: str
    external_id: str | None
    title: str | None
    company: str | None
    location: str | None
    url: str | None
    posted_at: str | None
    snippet: str | None


class JobDescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    raw_text: str
    parsed_json: dict | None
    capture_mode: str
    quality_score: float | None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    title: str | None
    company: str | None
    location: str | None
    url: str | None
    posted_at: str | None
    created_at: datetime


class JobWithJDOut(JobOut):
    description: JobDescriptionOut | None = None


class DiscoverResponse(BaseModel):
    jobs: list[JobStubOut]
