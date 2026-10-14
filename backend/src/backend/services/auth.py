import secrets
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from hashlib import sha256

from pwdlib import PasswordHash
from pydantic import EmailStr, TypeAdapter
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.core.exception import AuthenticationError, ConflictError, RateLimitError
from backend.models.auth import AuthSession, User
from backend.models.commerce import LoginThrottle
from backend.schemas.auth import LoginRequest, LoginResponse, UserResponse


def hash_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


@lru_cache
def dummy_hash() -> str:
    return PasswordHash.recommended().hash(secrets.token_urlsafe(32))


class AuthService:
    def __init__(self, db: AsyncSession, session_hours: int) -> None:
        self.db = db
        self.session_hours = session_hours
        self.password_hash = PasswordHash.recommended()

    @staticmethod
    def user_response(user: User) -> UserResponse:
        return UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone=user.phone,
            permissions=user.permissions,
            preferences=user.preferences,
            email_verified=user.email_verified,
        )

    async def create_user(self, email: str, password: str) -> UserResponse:
        normalized = str(TypeAdapter(EmailStr).validate_python(email.strip().lower()))
        if not 6 <= len(password) <= 1024:
            raise ValueError("Password must be between 6 and 1024 characters.")
        hashed = await run_in_threadpool(self.password_hash.hash, password)
        try:
            user = await User.create(self.db, normalized, hashed)
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictError("An account with this email already exists.") from exc
        return self.user_response(user)

    async def login(self, payload: LoginRequest) -> LoginResponse:
        key = hash_token(str(payload.email))
        # Serialize throttle updates per normalized email without blocking unrelated accounts.
        if self.db.get_bind().dialect.name == "postgresql":
            from sqlalchemy import text

            throttle_lock = int(key[:15], 16)
            await self.db.execute(
                text("SELECT pg_advisory_xact_lock(:key)"), {"key": throttle_lock}
            )
        throttle = await self.db.get(LoginThrottle, key)
        now = datetime.now(UTC)
        if throttle is None:
            throttle = LoginThrottle(key=key, attempts=0, window_start=now)
            self.db.add(throttle)
            await self.db.flush()
        from backend.services.common import utc

        if utc(throttle.window_start) <= now - timedelta(minutes=15):
            throttle.attempts = 0
            throttle.window_start = now
        if throttle.attempts >= 5:
            raise RateLimitError(
                "Too many sign-in attempts. Please try again in 15 minutes."
            )
        user = await User.by_email(self.db, str(payload.email))
        hashed = (
            user.password_hash
            if user is not None
            else await run_in_threadpool(dummy_hash)
        )
        valid = await run_in_threadpool(
            self.password_hash.verify, payload.password.get_secret_value(), hashed
        )
        if user is None or not valid or not user.is_active:
            throttle.attempts += 1
            await self.db.commit()
            raise AuthenticationError("Invalid email or password")
        throttle.attempts = 0
        now = datetime.now(UTC)
        expires_at = now + timedelta(hours=self.session_hours)
        token = secrets.token_urlsafe(32)
        await AuthSession.clear_expired(self.db, now)
        await AuthSession.create(self.db, hash_token(token), user.id, expires_at)
        await self.db.commit()
        return LoginResponse(
            session_token=token,
            expires_at=expires_at,
            user=self.user_response(user),
        )

    async def current_user(self, token: str) -> UserResponse:
        user = await AuthSession.authenticated_user(
            self.db, hash_token(token), datetime.now(UTC)
        )
        if user is None:
            raise AuthenticationError("Your session has expired. Please sign in again.")
        return self.user_response(user)

    async def logout(self, token: str) -> None:
        await AuthSession.revoke(self.db, hash_token(token))
        await self.db.commit()
