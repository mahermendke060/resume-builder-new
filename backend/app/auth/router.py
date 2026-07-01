import uuid

from fastapi import APIRouter
from jose import JWTError

from app.auth import service
from app.auth.deps import CurrentUser, DbSession
from app.auth.models import User
from app.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
    ChangePasswordRequest,
    UpdateProfileRequest,
)
from app.common.errors import AuthError
from app.common.security import create_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterRequest, db: DbSession) -> User:
    return service.register_user(db, payload)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    user = service.authenticate(db, payload.email, payload.password)
    access, refresh = service.issue_tokens(user)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token, "refresh")
        user_id = uuid.UUID(claims["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise AuthError("Invalid refresh token.") from exc

    user = db.get(User, user_id)
    if user is None or user.status != "active":
        raise AuthError("User not found or inactive.")

    return TokenPair(
        access_token=create_token(str(user.id), "access"),
        refresh_token=create_token(str(user.id), "refresh"),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.post("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> User:
    return service.change_password(
        db,
        current_user,
        payload.current_password,
        payload.new_password,
    )


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> User:
    return service.update_profile(db, current_user, payload)
