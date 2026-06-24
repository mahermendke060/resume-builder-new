"""High-level LLM operations used by the resume + tailor pipelines.

Each function returns plain dicts/lists (already JSON-validated by the adapter).
Callers validate against Pydantic schemas before persisting.
"""

from app.llm.adapter import LLMAdapter

# --- Resume structuring -------------------------------------------------------

_RESUME_SYSTEM = (
    "You are a precise resume parser. Extract the resume into canonical JSON sections. "
    "Do not invent information. Only use what is present in the text."
)

_RESUME_USER_TMPL = """Parse this resume into JSON with exactly this shape:
{{
  "contact": {{"name": str|null, "email": str|null, "phone": str|null, "location": str|null, "links": [str]}},
  "summary": str|null,
  "skills": [str],
  "experience": [
    {{"title": str, "company": str, "location": str|null, "start": str|null, "end": str|null,
      "bullets": [str]}}
  ],
  "education": [{{"degree": str, "institution": str, "year": str|null}}],
  "certifications": [str],
  "projects": [{{"name": str, "description": str|null, "bullets": [str]}}]
}}

Resume text:
---
{raw_text}
---
Return only the JSON object."""


async def structure_resume(llm: LLMAdapter, raw_text: str) -> dict:
    user = _RESUME_USER_TMPL.format(raw_text=raw_text[:20000])
    result = await llm.complete_json(_RESUME_SYSTEM, user)
    if not isinstance(result, dict):
        raise ValueError("structure_resume expected a JSON object")
    return result


# --- JD requirement extraction ------------------------------------------------

_JD_SYSTEM = (
    "You extract structured hiring requirements from a job description. "
    "Be faithful to the text; do not invent requirements."
)

_JD_USER_TMPL = """Extract requirements from this job description into JSON:
{{
  "title": str|null,
  "seniority": str|null,
  "must_have_skills": [str],
  "nice_to_have_skills": [str],
  "tools": [str],
  "responsibilities": [str],
  "keywords": [str],
  "min_years_experience": number|null
}}

Job description:
---
{jd_text}
---
Return only the JSON object."""


async def extract_jd_requirements(llm: LLMAdapter, jd_text: str) -> dict:
    user = _JD_USER_TMPL.format(jd_text=jd_text[:20000])
    result = await llm.complete_json(_JD_SYSTEM, user)
    if not isinstance(result, dict):
        raise ValueError("extract_jd_requirements expected a JSON object")
    return result


# --- Grounded tailored-resume generation --------------------------------------

_GEN_SYSTEM = (
    "You tailor a resume to a job description. CRITICAL RULES:\n"
    "1. Never invent experience, skills, employers, or dates not present in the source resume.\n"
    "2. You may rephrase, reorder, and emphasize existing facts to match the JD.\n"
    "3. Every rewritten bullet must cite the source bullet(s) it derives from by their id.\n"
    "Output strictly valid JSON."
)

_GEN_USER_TMPL = """Source resume (canonical JSON with stable snippet ids):
{resume_json}

Target job requirements (JSON):
{jd_json}

Produce a tailored resume as JSON, preserving ALL sections from the source resume:
{{
  "contact": {{"name": str|null, "email": str|null, "phone": str|null, "location": str|null, "links": [str]}},
  "summary": str,
  "skills": [str],
  "experience": [
    {{"title": str, "company": str, "location": str|null, "start": str|null, "end": str|null,
      "bullets": [{{"text": str, "source_ids": [str]}}]}}
  ],
  "education": [{{"degree": str, "institution": str, "year": str|null}}],
  "certifications": [str],
  "projects": [{{"name": str, "description": str|null, "bullets": [str]}}],
  "provenance_note": str
}}

CRITICAL RULES:
1. NEVER omit sections like education, certifications, or projects, even if they don't seem directly relevant to the job description!
2. Never invent experience, skills, employers, or dates not present in the source resume.
3. Only reorder/rephrase facts from the source resume to better match the job requirements.
4. Emphasize skills/keywords from the job requirements that the candidate genuinely has.
5. Preserve all factual information from the source resume, just tailor the wording and order.
Return only the JSON object."""

# Variant 1: Focus on technical skills and projects
_GEN_V1_SYSTEM = """You tailor a resume to a job description, focusing primarily on technical skills and projects. CRITICAL RULES:
1. Never invent experience, skills, employers, or dates not present in the source resume.
2. You may reorder, rephrase, and emphasize existing facts to match the JD.
3. Every rewritten bullet must cite the source bullet(s) it derives from by their id.
4. NEVER omit sections like education, certifications, or projects, even if they don't seem directly relevant to the job description!
Output strictly valid JSON."""

# Variant 2: Focus on experience and soft skills
_GEN_V2_SYSTEM = """You tailor a resume to a job description, focusing primarily on work experience and soft skills/leadership. CRITICAL RULES:
1. Never invent experience, skills, employers, or dates not present in the source resume.
2. You may reorder, rephrase, and emphasize existing facts to match the JD.
3. Every rewritten bullet must cite the source bullet(s) it derives from by their id.
4. NEVER omit sections like education, certifications, or projects, even if they don't seem directly relevant to the job description!
Output strictly valid JSON."""


async def generate_variant(llm: LLMAdapter, resume_json: dict, jd_json: dict, system_prompt: str | None = None) -> dict:
    import json

    user = _GEN_USER_TMPL.format(
        resume_json=json.dumps(resume_json, ensure_ascii=False)[:16000],
        jd_json=json.dumps(jd_json, ensure_ascii=False)[:8000],
    )
    result = await llm.complete_json(system_prompt or _GEN_SYSTEM, user)
    if not isinstance(result, dict):
        raise ValueError("generate_variant expected a JSON object")
    
    # Safeguard: Copy missing sections from original resume
    sections_to_preserve = ["contact", "education", "certifications", "projects"]
    for section in sections_to_preserve:
        if section not in result or result[section] is None or (isinstance(result[section], list) and len(result[section]) == 0):
            if section in resume_json and resume_json[section] is not None:
                result[section] = resume_json[section]
    
    return result
