import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base, TimestampMixin

# JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in tests).
JsonType = JSON().with_variant(JSONB(), "postgresql")


class Consent(Base, TimestampMixin):
    __tablename__ = "consents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "ai_processing"
    version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    # raw_only | structured | failed
    parse_status: Mapped[str] = mapped_column(String(20), default="raw_only", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
