import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base, TimestampMixin
from app.resumes.models import JsonType

# queued -> extracting -> generating -> scoring -> done | failed
TAILOR_STATES = ("queued", "extracting", "generating", "scoring", "done", "failed")


class TailorRun(Base, TimestampMixin):
    __tablename__ = "tailor_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ResumeVariant(Base, TimestampMixin):
    __tablename__ = "resume_variants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tailor_run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tailor_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    content_json: Mapped[dict] = mapped_column(JsonType, nullable=False)
    provenance_json: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    docx_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_key: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Score(Base, TimestampMixin):
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    variant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("resume_variants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    overall: Mapped[float] = mapped_column(Float, nullable=False)
    breakdown_json: Mapped[dict] = mapped_column(JsonType, nullable=False)
    missing_keywords_json: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    warnings_json: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
