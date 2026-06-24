import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, Session
from sqlalchemy.types import JSON

from app.common.db import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)


def log_action(
    db: Session,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    meta: dict | None = None,
) -> None:
    """Append an audit record. Commits independently of the caller's transaction state."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta,
        )
    )
    db.commit()
