"""Local file storage. Swap for S3-compatible storage later behind this interface."""

import uuid
from pathlib import Path

from app.common.config import settings

_ROOT = Path(settings.file_store_dir)


def _ensure_root() -> Path:
    _ROOT.mkdir(parents=True, exist_ok=True)
    return _ROOT


def save_bytes(data: bytes, *, suffix: str, subdir: str = "") -> str:
    """Persist bytes and return a storage key (relative path)."""
    _ensure_root()
    key = f"{subdir + '/' if subdir else ''}{uuid.uuid4().hex}{suffix}"
    path = _ROOT / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def read_bytes(key: str) -> bytes:
    return (_ROOT / key).read_bytes()


def abs_path(key: str) -> Path:
    return _ROOT / key


def delete(key: str) -> None:
    """Delete a stored file by key."""
    path = _ROOT / key
    if path.exists():
        path.unlink()
