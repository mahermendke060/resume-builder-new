"""Render a tailored resume variant to an ATS-safe PDF (single-column, text-based)."""

import io
import re
from xml.sax.saxutils import escape


def sanitize_text(text: str | None) -> str:
    if not text:
        return ""
    text = str(text)
    # Remove HTML tags first
    text = re.sub(r"<[^>]+>", "", text)
    # Replace all dash variants
    text = re.sub(r"[\u2011\u2012\u2013\u2014\u2015]", "-", text)
    # Replace smart single quotes
    text = re.sub(r"[\u2018\u2019\u201A\u201B]", "'", text)
    # Replace smart double quotes
    text = re.sub(r"[\u201C\u201D\u201E\u201F]", '"', text)
    # Replace ellipsis
    text = re.sub(r"[\u2026]", "...", text)
    # Replace all space variants
    text = re.sub(r"[\u00A0\u2000-\u200A\u202F\u205F\u3000]", " ", text)
    # Remove control characters
    text = re.sub(r"[\u0000-\u001F\u007F-\u009F]", "", text)
    # Remove backticks
    text = text.replace("`", "")
    # Trim whitespace
    text = text.strip()
    # Remove any leading/trailing non-alphanumeric characters (for emails/links)
    text = re.sub(r"^[^a-zA-Z0-9@]+|[^a-zA-Z0-9.]+$", "", text)
    return text


def _bullet_text(b) -> str:
    return escape(sanitize_text(b.get("text", "") if isinstance(b, dict) else str(b)))


def render_pdf(variant: dict, contact: dict | None = None) -> bytes:
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

    contact = contact or {}
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle("Name", parent=styles["Title"], alignment=TA_CENTER, fontSize=18)
    heading = ParagraphStyle("H", parent=styles["Heading2"], fontSize=12, spaceBefore=10)
    body = styles["BodyText"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    )
    flow = []

    if contact.get("name"):
        flow.append(Paragraph(escape(sanitize_text(contact["name"])), name_style))
    
    # Build contact line
    contact_parts = []
    if contact.get("email"):
        contact_parts.append(escape(sanitize_text(contact["email"])))
    if contact.get("phone"):
        contact_parts.append(escape(sanitize_text(contact["phone"])))
    if contact.get("location"):
        contact_parts.append(escape(sanitize_text(contact["location"])))
    contact_line = " | ".join(contact_parts)
    if contact_line:
        flow.append(Paragraph(contact_line, ParagraphStyle("C", parent=body, alignment=TA_CENTER)))
    
    # Add links
    if contact.get("links"):
        links_line = " • ".join(escape(sanitize_text(link)) for link in contact["links"])
        flow.append(Paragraph(links_line, ParagraphStyle("Links", parent=body, alignment=TA_CENTER)))
    
    flow.append(Spacer(1, 6))

    if variant.get("summary"):
        flow += [Paragraph("Summary", heading), Paragraph(escape(sanitize_text(variant["summary"])), body)]

    if variant.get("skills"):
        flow += [Paragraph("Skills", heading), Paragraph(", ".join(escape(sanitize_text(s)) for s in variant["skills"]), body)]

    if variant.get("experience"):
        flow.append(Paragraph("Experience", heading))
        for exp in variant["experience"]:
            title = " &mdash; ".join(x for x in (escape(sanitize_text(exp.get("title"))), escape(sanitize_text(exp.get("company")))) if x)
            dates = " ".join(x for x in (escape(sanitize_text(exp.get("start"))), escape(sanitize_text(exp.get("end")))) if x)
            header = f"<b>{title}</b>" + (f" ({dates})" if dates else "")
            flow.append(Paragraph(header, body))
            items = [
                ListItem(Paragraph(_bullet_text(b), body))
                for b in (exp.get("bullets", []) or [])
            ]
            if items:
                flow.append(ListFlowable(items, bulletType="bullet"))

    if variant.get("education"):
        flow.append(Paragraph("Education", heading))
        for ed in variant["education"]:
            line = ", ".join(escape(sanitize_text(ed[k])) for k in ("degree", "institution", "year") if ed.get(k))
            flow.append(Paragraph(line, body))

    if variant.get("certifications"):
        flow.append(Paragraph("Certifications", heading))
        items = [ListItem(Paragraph(escape(sanitize_text(cert)), body)) for cert in variant["certifications"]]
        flow.append(ListFlowable(items, bulletType="bullet"))

    if variant.get("projects"):
        flow.append(Paragraph("Projects", heading))
        for proj in variant["projects"]:
            flow.append(Paragraph(f"<b>{escape(sanitize_text(proj.get('name', '')))}</b>", body))
            if proj.get("description"):
                flow.append(Paragraph(escape(sanitize_text(proj["description"])), body))
            if proj.get("bullets"):
                items = [ListItem(Paragraph(_bullet_text(b), body)) for b in proj["bullets"]]
                flow.append(ListFlowable(items, bulletType="bullet"))

    doc.build(flow)
    return buf.getvalue()
