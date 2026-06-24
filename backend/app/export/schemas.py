from pydantic import BaseModel


class ExportRequest(BaseModel):
    format: str = "docx"  # docx | pdf


class ExportResponse(BaseModel):
    format: str
    download_url: str
