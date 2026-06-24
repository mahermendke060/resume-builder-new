"""Import all ORM models so Alembic autogenerate + Base.metadata see them.

Import this module (not individual model modules) wherever full metadata is needed.
"""

from app.auth.models import User  # noqa: F401
from app.common.audit import AuditLog  # noqa: F401
from app.jobs.models import Job, JobDescription  # noqa: F401
from app.resumes.models import Consent, Resume  # noqa: F401
from app.tailor.models import ResumeVariant, Score, TailorRun  # noqa: F401

__all__ = [
    "User", "AuditLog", "Consent", "Resume", "Job", "JobDescription",
    "TailorRun", "ResumeVariant", "Score",
]
