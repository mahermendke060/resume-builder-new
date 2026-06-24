import uuid

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.auth.deps import CurrentUser, DbSession
from app.common import storage
from app.common.audit import log_action
from app.common.errors import AppError, NotFoundError
from app.export.docx import render_docx
from app.export.pdf import render_pdf
from app.export.schemas import ExportRequest, ExportResponse
from app.resumes.models import Resume
from app.tailor import service
from app.tailor.models import TailorRun

router = APIRouter(tags=["export"])

_CONTENT_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}


def _contact_for_variant(db, variant) -> dict | None:
    # First check if tailored variant has contact info
    if variant.content_json and variant.content_json.get("contact"):
        return variant.content_json["contact"]
    # Fall back to original resume contact info
    run = db.get(TailorRun, variant.tailor_run_id)
    resume = db.get(Resume, run.resume_id) if run else None
    if resume and resume.parsed_json:
        return resume.parsed_json.get("contact")
    return None


@router.post("/variants/{variant_id}/export", response_model=ExportResponse)
def export_variant(
    variant_id: uuid.UUID, payload: ExportRequest, user: CurrentUser, db: DbSession
):
    fmt = payload.format.lower()
    if fmt not in _CONTENT_TYPES:
        raise AppError("format must be 'docx' or 'pdf'.", code="bad_format")

    variant = service.get_variant_owned(db, user.id, variant_id)
    contact = _contact_for_variant(db, variant)

    if fmt == "docx":
        data = render_docx(variant.content_json, contact)
    else:
        data = render_pdf(variant.content_json, contact)

    key = storage.save_bytes(data, suffix=f".{fmt}", subdir="exports")
    if fmt == "docx":
        variant.docx_key = key
    else:
        variant.pdf_key = key
    db.add(variant)
    db.commit()
    log_action(db, user.id, "variant.exported", "resume_variant", variant.id, {"format": fmt})

    return ExportResponse(format=fmt, download_url=f"/variants/{variant_id}/file?format={fmt}")


@router.get("/variants/{variant_id}/file")
def download_variant(
    variant_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    format: str = Query("docx"),
):
    fmt = format.lower()
    if fmt not in _CONTENT_TYPES:
        raise AppError("format must be 'docx' or 'pdf'.", code="bad_format")

    variant = service.get_variant_owned(db, user.id, variant_id)
    key = variant.docx_key if fmt == "docx" else variant.pdf_key
    if not key:
        raise NotFoundError(f"No {fmt} export exists yet. POST the export first.")

    data = storage.read_bytes(key)
    return Response(
        content=data,
        media_type=_CONTENT_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="resume.{fmt}"'},
    )
