from datetime import timedelta
from typing import Literal

import bcrypt
from jose import JWTError, jwt

from app.common.config import settings
from app.common.db import utcnow

TokenType = Literal["access", "refresh"]

# bcrypt operates on at most 72 bytes; truncate consistently so longer inputs
# don't raise and verification stays deterministic.
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_token(subject: str, token_type: TokenType) -> str:
    ttl = settings.jwt_access_ttl if token_type == "access" else settings.jwt_refresh_ttl
    now = utcnow()
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType) -> dict:
    """Decode + validate a JWT. Raises JWTError on any problem."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise JWTError(f"expected {expected_type} token")
    return payload
