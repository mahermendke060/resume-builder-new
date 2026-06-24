"""Transparent ATS-style scoring.

Pure, deterministic functions — no LLM, no network. Every number is traceable to
an input signal, which is the product's trust differentiator. Five weighted
components sum to 100.

v1 "semantic fit" is lexical (token coverage). Swap to embeddings later behind
``_semantic_fit`` without changing the interface.
"""

import re
from dataclasses import dataclass, field

WEIGHTS = {
    "format": 20,
    "keywords": 25,
    "skills_alignment": 20,
    "semantic_fit": 20,
    "evidence_grounding": 15,
}

_SYNONYMS = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "gcp": "google cloud",
    "ml": "machine learning",
}

_STOPWORDS = {
    "the", "and", "for", "with", "you", "your", "are", "our", "will", "have", "has",
    "this", "that", "from", "all", "who", "into", "out", "use", "using", "able", "work",
    "team", "role", "job", "we", "a", "an", "to", "of", "in", "on", "as", "is", "be",
    "or", "by", "at", "it", "their", "they", "etc", "such", "including", "experience",
}

_WORD = re.compile(r"[a-z0-9+#.]+")


def _norm(text: str) -> str:
    return (text or "").strip().lower()


def _norm_skill(s: str) -> str:
    s = _norm(s)
    return _SYNONYMS.get(s, s)


def _tokens(text: str) -> set[str]:
    return {_SYNONYMS.get(t, t) for t in _WORD.findall(_norm(text)) if t not in _STOPWORDS}


# --- variant flattening -------------------------------------------------------

def _variant_bullets(variant: dict) -> list[dict]:
    bullets: list[dict] = []
    for exp in variant.get("experience", []) or []:
        for b in exp.get("bullets", []) or []:
            if isinstance(b, dict):
                bullets.append(b)
            elif isinstance(b, str):
                bullets.append({"text": b, "source_ids": []})
    return bullets


def _variant_text(variant: dict) -> str:
    parts = [variant.get("summary") or ""]
    parts += variant.get("skills", []) or []
    for b in _variant_bullets(variant):
        parts.append(b.get("text", ""))
    return " ".join(parts)


def _variant_skills(variant: dict) -> set[str]:
    return {_norm_skill(s) for s in (variant.get("skills", []) or []) if s}


def _resume_snippet_ids(resume_parsed: dict | None) -> set[str]:
    ids: set[str] = set()
    if not resume_parsed:
        return ids
    for section in ("experience", "projects"):
        for entry in resume_parsed.get(section, []) or []:
            for b in entry.get("bullets", []) or []:
                if isinstance(b, dict) and b.get("id"):
                    ids.add(b["id"])
    return ids


# --- components (each returns raw 0..1) --------------------------------------

def _format_score(variant: dict) -> float:
    bullets = _variant_bullets(variant)
    structural = [
        bool(_norm(variant.get("summary") or "")),
        len(variant.get("skills", []) or []) >= 3,
        len(bullets) >= 1,
    ]
    base = sum(structural) / len(structural)
    quantified = sum(1 for b in bullets if re.search(r"\d", b.get("text", ""))) / max(len(bullets), 1)
    return round(0.7 * base + 0.3 * min(1.0, quantified / 0.5), 4)


def _keyword_coverage(variant: dict, jd: dict) -> tuple[float, list[str]]:
    must = [_norm_skill(s) for s in (jd.get("must_have_skills") or []) if s]
    if not must:
        must = [_norm_skill(s) for s in (jd.get("keywords") or []) if s]
    if not must:
        return 1.0, []
    text = _norm(_variant_text(variant))
    found, missing = [], []
    for kw in must:
        (found if kw and kw in text else missing).append(kw)
    return round(len(found) / len(must), 4), missing


def _skills_alignment(variant: dict, jd: dict) -> float:
    jd_skills = {
        _norm_skill(s)
        for key in ("must_have_skills", "nice_to_have_skills", "tools")
        for s in (jd.get(key) or [])
        if s
    }
    if not jd_skills:
        return 1.0
    overlap = _variant_skills(variant) & jd_skills
    return round(len(overlap) / len(jd_skills), 4)


def _semantic_fit(variant: dict, jd: dict) -> float:
    jd_text = " ".join(
        [jd.get("title") or ""]
        + (jd.get("responsibilities") or [])
        + (jd.get("keywords") or [])
        + (jd.get("must_have_skills") or [])
    )
    jd_tokens = _tokens(jd_text)
    if not jd_tokens:
        return 1.0
    v_tokens = _tokens(_variant_text(variant))
    return round(len(jd_tokens & v_tokens) / len(jd_tokens), 4)


def _evidence_grounding(variant: dict, resume_parsed: dict | None) -> tuple[float, int]:
    bullets = _variant_bullets(variant)
    if not bullets:
        return 0.0, 0
    valid = _resume_snippet_ids(resume_parsed)
    grounded = 0
    for b in bullets:
        sids = b.get("source_ids") or []
        if sids and (not valid or all(s in valid for s in sids)):
            grounded += 1
    ungrounded = len(bullets) - grounded
    return round(grounded / len(bullets), 4), ungrounded


# --- public API ---------------------------------------------------------------

@dataclass
class ScoreResult:
    overall: float
    breakdown: dict[str, float]
    missing_keywords: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def score_variant(variant: dict, jd: dict, resume_parsed: dict | None = None) -> ScoreResult:
    fmt = _format_score(variant)
    kw, missing = _keyword_coverage(variant, jd)
    skills = _skills_alignment(variant, jd)
    sem = _semantic_fit(variant, jd)
    grounding, ungrounded = _evidence_grounding(variant, resume_parsed)

    raw = {
        "format": fmt,
        "keywords": kw,
        "skills_alignment": skills,
        "semantic_fit": sem,
        "evidence_grounding": grounding,
    }
    breakdown = {k: round(v * WEIGHTS[k], 1) for k, v in raw.items()}
    overall = round(sum(breakdown.values()), 1)

    warnings: list[str] = []
    if ungrounded:
        warnings.append(f"{ungrounded} generated bullet(s) lack valid source evidence.")
    if len(variant.get("skills", []) or []) > 30:
        warnings.append("Skills list is very long — may read as keyword stuffing.")
    generic = sum(
        1 for b in _variant_bullets(variant) if len(b.get("text", "").split()) < 4
    )
    if generic:
        warnings.append(f"{generic} bullet(s) appear overly generic/short.")

    return ScoreResult(
        overall=overall,
        breakdown=breakdown,
        missing_keywords=missing,
        warnings=warnings,
    )
