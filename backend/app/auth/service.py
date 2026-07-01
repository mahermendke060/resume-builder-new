from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.schemas import RegisterRequest, UpdateProfileRequest
from app.common.errors import AuthError, ConflictError
from app.common.security import (
    create_token,
    hash_password,
    verify_password,
)


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing is not None:
        raise ConflictError("An account with this email already exists.")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password.")
    if user.status != "active":
        raise AuthError("Account is not active.")
    return user


def issue_tokens(user: User) -> tuple[str, str]:
    return (
        create_token(str(user.id), "access"),
        create_token(str(user.id), "refresh"),
    )


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not verify_password(current_password, user.password_hash):
        raise AuthError("Current password is incorrect.")
    
    user.password_hash = hash_password(new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, payload: UpdateProfileRequest) -> User:
    if payload.name is not None:
        user.name = payload.name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
