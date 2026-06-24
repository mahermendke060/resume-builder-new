"""Job discovery via SerpApi (Google Jobs engine).

Discovery returns lightweight job *stubs* only. We do NOT server-side fetch
gated platforms (LinkedIn/Indeed); the user clicks through or pastes the JD.
Provider is swappable behind this interface.
"""

from dataclasses import dataclass

import httpx

from app.common.config import settings
from app.common.errors import AppError


class SearchError(AppError):
    status_code = 502
    code = "search_error"


@dataclass
class JobStub:
    source: str
    external_id: str | None
    title: str | None
    company: str | None
    location: str | None
    url: str | None
    posted_at: str | None
    snippet: str | None


def _canonical_key(stub: JobStub) -> tuple:
    return (
        (stub.title or "").strip().lower(),
        (stub.company or "").strip().lower(),
        (stub.location or "").strip().lower(),
    )


class SearchAdapter:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key if api_key is not None else settings.serpapi_key
        self.base_url = base_url or settings.serpapi_base_url

    async def discover(self, query: str, location: str | None, top_k: int = 5) -> list[JobStub]:
        if not self.api_key:
            raise SearchError("SERPAPI_KEY is not configured.")
        params = {
            "engine": "google_jobs",
            "q": query,
            "api_key": self.api_key,
        }
        if location:
            params["location"] = location

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(self.base_url, params=params)
        if resp.status_code >= 400:
            raise SearchError(f"SerpApi request failed ({resp.status_code}): {resp.text[:200]}")

        data = resp.json()
        stubs = [self._to_stub(item) for item in data.get("jobs_results", [])]
        return self._dedupe(stubs)[:top_k]

    @staticmethod
    def _to_stub(item: dict) -> JobStub:
        # Prefer a real apply link when present.
        url = None
        options = item.get("apply_options") or []
        if options and isinstance(options, list):
            url = options[0].get("link")
        url = url or item.get("share_link")
        return JobStub(
            source="serpapi",
            external_id=item.get("job_id"),
            title=item.get("title"),
            company=item.get("company_name"),
            location=item.get("location"),
            url=url,
            posted_at=(item.get("detected_extensions") or {}).get("posted_at"),
            snippet=item.get("description"),
        )

    @staticmethod
    def _dedupe(stubs: list[JobStub]) -> list[JobStub]:
        seen: set[tuple] = set()
        out: list[JobStub] = []
        for s in stubs:
            key = _canonical_key(s)
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
        return out


def get_search() -> SearchAdapter:
    """Dependency hook (overridable in tests)."""
    return SearchAdapter()
