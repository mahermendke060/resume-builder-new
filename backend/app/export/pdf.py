"""Render a tailored resume variant to an ATS-safe PDF (single-column, text-based)."""

import io


def _bullet_text(b) -> str:
    return b.get("text", "") if isinstance(b, dict) else str(b)


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
        flow.append(Paragraph(contact["name"], name_style))
    
    # Build contact line
    contact_parts = []
    if contact.get("email"):
        contact_parts.append(contact["email"])
    if contact.get("phone"):
        contact_parts.append(contact["phone"])
    if contact.get("location"):
        contact_parts.append(contact["location"])
    contact_line = " | ".join(contact_parts)
    if contact_line:
        flow.append(Paragraph(contact_line, ParagraphStyle("C", parent=body, alignment=TA_CENTER)))
    
    # Add links
    if contact.get("links"):
        links_line = " • ".join(contact["links"])
        flow.append(Paragraph(links_line, ParagraphStyle("Links", parent=body, alignment=TA_CENTER)))
    
    flow.append(Spacer(1, 6))

    if variant.get("summary"):
        flow += [Paragraph("Summary", heading), Paragraph(variant["summary"], body)]

    if variant.get("skills"):
        flow += [Paragraph("Skills", heading), Paragraph(", ".join(variant["skills"]), body)]

    if variant.get("experience"):
        flow.append(Paragraph("Experience", heading))
        for exp in variant["experience"]:
            title = " &mdash; ".join(x for x in (exp.get("title"), exp.get("company")) if x)
            dates = " ".join(x for x in (exp.get("start"), exp.get("end")) if x)
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
            line = ", ".join(str(ed[k]) for k in ("degree", "institution", "year") if ed.get(k))
            flow.append(Paragraph(line, body))

    if variant.get("certifications"):
        flow.append(Paragraph("Certifications", heading))
        items = [ListItem(Paragraph(cert, body)) for cert in variant["certifications"]]
        flow.append(ListFlowable(items, bulletType="bullet"))

    if variant.get("projects"):
        flow.append(Paragraph("Projects", heading))
        for proj in variant["projects"]:
            flow.append(Paragraph(f"<b>{proj.get('name', '')}</b>", body))
            if proj.get("description"):
                flow.append(Paragraph(proj["description"], body))
            if proj.get("bullets"):
                items = [ListItem(Paragraph(_bullet_text(b), body)) for b in proj["bullets"]]
                flow.append(ListFlowable(items, bulletType="bullet"))

    doc.build(flow)
    return buf.getvalue()
