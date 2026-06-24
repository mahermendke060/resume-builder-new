from app.scoring.engine import WEIGHTS, score_variant

JD = {
    "title": "Senior Python Backend Engineer",
    "must_have_skills": ["python", "fastapi", "postgresql"],
    "nice_to_have_skills": ["aws"],
    "tools": ["docker"],
    "responsibilities": ["design apis", "own services end to end"],
    "keywords": ["python", "fastapi", "postgresql", "aws", "docker"],
}

RESUME_PARSED = {
    "experience": [
        {"bullets": [{"id": "e0b0", "text": "Built APIs in FastAPI"},
                     {"id": "e0b1", "text": "Optimized Postgres queries"}]}
    ],
    "projects": [],
}

GOOD_VARIANT = {
    "summary": "Backend engineer specializing in Python and FastAPI.",
    "skills": ["Python", "FastAPI", "PostgreSQL", "AWS", "Docker"],
    "experience": [
        {"title": "Engineer", "company": "Acme", "bullets": [
            {"text": "Built scalable APIs in FastAPI serving 10000 requests/s", "source_ids": ["e0b0"]},
            {"text": "Optimized PostgreSQL queries cutting latency 40%", "source_ids": ["e0b1"]},
        ]}
    ],
}


def test_weights_sum_to_100():
    assert sum(WEIGHTS.values()) == 100


def test_good_variant_scores_high():
    res = score_variant(GOOD_VARIANT, JD, RESUME_PARSED)
    assert res.overall > 80
    assert set(res.breakdown) == set(WEIGHTS)
    assert res.missing_keywords == []
    # all bullets grounded -> full evidence weight
    assert res.breakdown["evidence_grounding"] == WEIGHTS["evidence_grounding"]


def test_breakdown_sums_to_overall():
    res = score_variant(GOOD_VARIANT, JD, RESUME_PARSED)
    assert round(sum(res.breakdown.values()), 1) == res.overall


def test_missing_keywords_detected():
    variant = {**GOOD_VARIANT, "skills": ["Python"],
               "summary": "Python developer.",
               "experience": [{"bullets": [{"text": "Wrote Python code", "source_ids": ["e0b0"]}]}]}
    res = score_variant(variant, JD, RESUME_PARSED)
    assert "fastapi" in res.missing_keywords
    assert "postgresql" in res.missing_keywords
    assert res.overall < 80


def test_ungrounded_bullets_warned_and_penalized():
    variant = {
        "summary": "Engineer.",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "experience": [{"bullets": [
            {"text": "Invented a fictional achievement", "source_ids": ["x9z9"]},
        ]}],
    }
    res = score_variant(variant, JD, RESUME_PARSED)
    assert res.breakdown["evidence_grounding"] == 0.0
    assert any("evidence" in w for w in res.warnings)
