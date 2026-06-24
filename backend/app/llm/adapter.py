"""OpenRouter LLM adapter (OpenAI-compatible chat completions).

Free OSS models are inconsistent at emitting valid JSON, so `complete_json`
parses defensively and retries once with a repair instruction.
"""

import json
import re

import httpx

from app.common.config import settings
from app.common.errors import AppError


class LLMError(AppError):
    status_code = 502
    code = "llm_error"


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", re.DOTALL)


def _extract_json(text: str) -> dict | list:
    """Pull a JSON object/array out of a model response that may wrap it in prose."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _JSON_FENCE.search(text)
    if m:
        return json.loads(m.group(1))
    # Last resort: first balanced-looking object/array slice.
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    end = max(text.rfind("}"), text.rfind("]"))
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise json.JSONDecodeError("no JSON found", text, 0)


class LLMAdapter:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.openrouter_api_key
        self.base_url = (base_url or settings.openrouter_base_url).rstrip("/")
        self.model = model or settings.openrouter_model
        self.timeout = timeout or settings.llm_timeout_seconds

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            # OpenRouter attribution headers (optional but recommended).
            "HTTP-Referer": "https://resumebuilder.local",
            "X-Title": "ResumeBuilder",
        }

    async def complete(self, system: str, user: str, temperature: float = 0.2) -> str:
        if not self.api_key:
            raise LLMError("OPENROUTER_API_KEY is not configured.")
        print("LLM call starting, model:", self.model)
        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        print("Calling OpenRouter...")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
            print("OpenRouter response status:", resp.status_code)
            if resp.status_code == 429:
                raise LLMError("LLM rate limit hit (free model throttled). Try again shortly.")
            if resp.status_code >= 400:
                raise LLMError(f"LLM request failed ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            try:
                print("LLM call complete!")
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as exc:
                raise LLMError("Malformed LLM response.") from exc
        except Exception as e:
            print("Error during LLM call:", e)
            raise

    async def complete_json(self, system: str, user: str) -> dict | list:
        """Request JSON; on parse failure, retry once asking for valid JSON only."""
        raw = await self.complete(system, user)
        try:
            return _extract_json(raw)
        except json.JSONDecodeError:
            repair_system = (
                "You output ONLY valid minified JSON. No prose, no markdown fences."
            )
            repair_user = (
                "Convert the following into valid JSON only, preserving its content:\n\n"
                + raw
            )
            raw2 = await self.complete(repair_system, repair_user, temperature=0.0)
            try:
                return _extract_json(raw2)
            except json.JSONDecodeError as exc:
                raise LLMError("LLM did not return valid JSON after repair.") from exc


def get_llm() -> LLMAdapter:
    """FastAPI/worker dependency hook (overridable in tests)."""
    return LLMAdapter()
