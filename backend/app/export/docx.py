"""Render a tailored resume variant to an ATS-safe DOCX.

ATS-safe rules: single column, real heading paragraphs, no tables / text boxes /
headers-footers, standard fonts, plain bullet lists.
"""

import io


def _bullet_text(b) -> str:
    return b.get("text", "") if isinstance(b, dict) else str(b)


def render_docx(variant: dict, contact: dict | None = None) -> bytes:
    from docx import Document
    from docx.shared import Pt

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    contact = contact or {}
    if contact.get("name"):
        h = doc.add_heading(contact["name"], level=0)
        h.alignment = 1  # center
    
    # Build contact line including links
    contact_parts = []
    if contact.get("email"):
        contact_parts.append(contact["email"])
    if contact.get("phone"):
        contact_parts.append(contact["phone"])
    if contact.get("location"):
        contact_parts.append(contact["location"])
    contact_line = " | ".join(contact_parts)
    if contact_line:
        p = doc.add_paragraph()
        p.add_run(contact_line)
    
    # Add links on new line
    if contact.get("links"):
        p = doc.add_paragraph()
        for i, link in enumerate(contact["links"]):
            if i > 0:
                p.add_run(" • ")
            p.add_run(link)

    if variant.get("summary"):
        doc.add_heading("Summary", level=1)
        doc.add_paragraph(variant["summary"])

    if variant.get("skills"):
        doc.add_heading("Skills", level=1)
        doc.add_paragraph(", ".join(variant["skills"]))

    if variant.get("experience"):
        doc.add_heading("Experience", level=1)
        for exp in variant["experience"]:
            title = " — ".join(x for x in (exp.get("title"), exp.get("company")) if x)
            dates = " ".join(x for x in (exp.get("start"), exp.get("end")) if x)
            p = doc.add_paragraph()
            p.add_run(title).bold = True
            if dates:
                p.add_run(f"  ({dates})")
            for b in exp.get("bullets", []) or []:
                doc.add_paragraph(_bullet_text(b), style="List Bullet")

    if variant.get("education"):
        doc.add_heading("Education", level=1)
        for ed in variant["education"]:
            line = ", ".join(
                str(ed[k]) for k in ("degree", "institution", "year") if ed.get(k)
            )
            doc.add_paragraph(line)

    if variant.get("certifications"):
        doc.add_heading("Certifications", level=1)
        for cert in variant["certifications"]:
            doc.add_paragraph(cert, style="List Bullet")

    if variant.get("projects"):
        doc.add_heading("Projects", level=1)
        for proj in variant["projects"]:
            p = doc.add_paragraph()
            p.add_run(proj.get("name", "")).bold = True
            if proj.get("description"):
                doc.add_paragraph(proj["description"])
            if proj.get("bullets"):
                for b in proj["bullets"]:
                    doc.add_paragraph(_bullet_text(b), style="List Bullet")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
