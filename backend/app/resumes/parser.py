"""Extract raw text from uploaded resume files (PDF / DOCX / TXT)."""

import io

from app.common.errors import AppError


class UnsupportedFileError(AppError):
    status_code = 415
    code = "unsupported_file"


def _from_pdf(data: bytes) -> str:
    print(f"=== Extracting PDF, {len(data)} bytes ===")
    try:
        from pypdf import PdfReader
        print("Using pypdf...")
        reader = PdfReader(io.BytesIO(data))
        print(f"PDF has {len(reader.pages)} pages")
        text_parts = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            print(f"Page {i+1} extracted {len(page_text)} chars")
            text_parts.append(page_text)
        combined = "\n".join(text_parts).strip()
        print(f"Total extracted: {len(combined)} chars")
        if len(combined) > 50:
            return combined
    except Exception as e:
        print(f"ERROR in pypdf: {type(e).__name__}: {e}")
    
    # Try OCR if regular text extraction failed
    print("Trying OCR...")
    try:
        from PIL import Image
        import pytesseract
        from pypdf import PdfReader

        # Convert PDF pages to images first
        # We'll use pdf2image to convert PDF pages to images
        try:
            from pdf2image import convert_from_bytes
        except ImportError:
            print("pdf2image not available, skipping OCR")
            return ""
        
        pages = convert_from_bytes(data)
        print(f"PDF converted to {len(pages)} images for OCR")
        
        text_parts = []
        for i, page_image in enumerate(pages):
            print(f"Running OCR on page {i+1}...")
            page_text = pytesseract.image_to_string(page_image)
            text_parts.append(page_text)
        
        combined = "\n".join(text_parts).strip()
        print(f"OCR extracted {len(combined)} chars")
        return combined
    except Exception as e:
        print(f"ERROR in OCR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return ""


def _from_docx(data: bytes) -> str:
    import docx2txt

    with io.BytesIO(data) as buf:
        return docx2txt.process(buf) or ""


def extract_text(data: bytes, filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text = _from_pdf(data)
    elif name.endswith(".docx"):
        text = _from_docx(data)
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise UnsupportedFileError("Only PDF, DOCX, or TXT resumes are supported.")

    text = text.strip()
    if not text:
        raise AppError(
            "Could not extract text from uploaded file. If this is a scanned PDF, try copying and pasting the text into a .txt file, or convert it to a DOCX file using OCR.",
            code="empty_resume"
        )
    return text


def suffix_for(filename: str) -> str:
    name = (filename or "").lower()
    for ext in (".pdf", ".docx", ".txt"):
        if name.endswith(ext):
            return ext
    return ".bin"
