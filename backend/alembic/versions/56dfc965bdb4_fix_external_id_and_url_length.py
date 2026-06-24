"""fix external_id and url length

Revision ID: 56dfc965bdb4
Revises: 0a9baceeb93d
Create Date: 2026-06-21 13:19:26.359673
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '56dfc965bdb4'
down_revision: str | None = '0a9baceeb93d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column('jobs', 'external_id',
        existing_type=sa.String(255),
        type_=sa.String(1024),
        existing_nullable=True)

def downgrade() -> None:
    op.alter_column('jobs', 'external_id',
        existing_type=sa.String(1024),
        type_=sa.String(255),
        existing_nullable=True)