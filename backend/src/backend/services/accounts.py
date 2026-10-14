import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.core.config import Settings
from backend.core.exception import AuthenticationError, ValidationError
from backend.models.auth import AuthSession, User
from backend.models.commerce import AccountToken, Address, Newsletter, Notification
from backend.schemas.auth import LoginRequest, LoginResponse, UserResponse
from backend.schemas.commerce import (
    AddressInput,
    ChangePassword,
    ProfilePatch,
    RegisterRequest,
    ResetRequest,
)
from backend.services.auth import AuthService, hash_token
from backend.services.common import require_found, utc


class AccountService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings
        self.auth = AuthService(db, settings.session_hours)

    async def register(self, payload: RegisterRequest) -> LoginResponse:
        created = await self.auth.create_user(
            str(payload.email), payload.password.get_secret_value()
        )
        user = require_found(await self.db.get(User, created.id), "Account")
        user.name = payload.name
        user.role = "customer"
        await self.db.commit()
        response = await self.auth.login(
            LoginRequest(email=user.email, password=payload.password)
        )
        if self.settings.enable_email_verification:
            await self.send_token(user.email, "verification")
        return response

    async def profile(self, actor: UserResponse, payload: ProfilePatch) -> UserResponse:
        user = require_found(await self.db.get(User, actor.id), "Account")
        for key, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(user, key, value)
        if payload.preferences is not None and "newsletter" in payload.preferences:
            consent = payload.preferences["newsletter"] is True
            subscription = await self.db.scalar(
                select(Newsletter).where(Newsletter.email == user.email)
            )
            if subscription:
                subscription.active = consent
                subscription.consent = consent
            elif consent:
                self.db.add(Newsletter(email=user.email, consent=True, active=True))
        await self.db.commit()
        return self.auth.user_response(user)

    async def send_token(self, email: str, kind: str) -> None:
        user = await User.by_email(self.db, email.strip().lower())
        if user is None or not user.is_active:
            return
        # Lock user so a concurrent reset cannot create several usable tokens.
        result = await self.db.execute(
            select(User).where(User.id == user.id).with_for_update()
        )
        user = result.scalars().one()
        recent = await self.db.scalar(
            select(AccountToken)
            .where(
                AccountToken.user_id == user.id,
                AccountToken.kind == kind,
                AccountToken.used.is_(False),
            )
            .order_by(AccountToken.created_at.desc())
            .limit(1)
        )
        if recent and utc(recent.created_at) > datetime.now(UTC) - timedelta(minutes=1):
            return
        await self.db.execute(
            delete(AccountToken).where(
                AccountToken.user_id == user.id, AccountToken.kind == kind
            )
        )
        token = secrets.token_urlsafe(32)
        self.db.add(
            AccountToken(
                user_id=user.id,
                token_hash=hash_token(token),
                kind=kind,
                expires_at=datetime.now(UTC) + timedelta(minutes=30),
            )
        )
        route = "reset-password" if kind == "reset" else "verify-email"
        link = f"{self.settings.app_origin}/{route}?token={token}"
        subject = (
            "Reset your Paper & Petal password"
            if kind == "reset"
            else "Verify your email address"
        )
        self.db.add(
            Notification(
                user_id=user.id,
                recipient=user.email,
                subject=subject,
                body=f"Hello {user.name or 'there'},\n\nUse this link within 30 minutes:\n{link}\n\nIf you did not request this, ignore this message.",
            )
        )
        await self.db.commit()

    async def reset(self, payload: ResetRequest) -> None:
        token = require_found(
            await self.db.scalar(
                select(AccountToken)
                .where(
                    AccountToken.token_hash == hash_token(payload.token),
                    AccountToken.kind == "reset",
                )
                .with_for_update()
            ),
            "Reset link",
        )
        if token.used or utc(token.expires_at) <= datetime.now(UTC):
            raise ValidationError("This reset link has expired or was already used.")
        user = require_found(await self.db.get(User, token.user_id), "Account")
        user.password_hash = await run_in_threadpool(
            self.auth.password_hash.hash, payload.password.get_secret_value()
        )
        token.used = True
        await self.db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        await self.db.commit()

    async def verify_email(self, token_value: str) -> None:
        token = require_found(
            await self.db.scalar(
                select(AccountToken)
                .where(
                    AccountToken.token_hash == hash_token(token_value),
                    AccountToken.kind == "verification",
                )
                .with_for_update()
            ),
            "Verification link",
        )
        if token.used or utc(token.expires_at) <= datetime.now(UTC):
            raise ValidationError(
                "This verification link has expired or was already used."
            )
        user = require_found(await self.db.get(User, token.user_id), "Account")
        user.email_verified = True
        token.used = True
        await self.db.commit()

    async def change_password(
        self, actor: UserResponse, payload: ChangePassword
    ) -> None:
        user = require_found(await self.db.get(User, actor.id), "Account")
        valid = await run_in_threadpool(
            self.auth.password_hash.verify,
            payload.current_password.get_secret_value(),
            user.password_hash,
        )
        if not valid:
            raise AuthenticationError("Current password is incorrect.")
        user.password_hash = await run_in_threadpool(
            self.auth.password_hash.hash, payload.password.get_secret_value()
        )
        await self.db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        await self.db.commit()

    async def save_address(
        self, actor: UserResponse, payload: AddressInput, identifier: UUID | None = None
    ) -> Address:
        if payload.is_default:
            rows = (
                await self.db.scalars(
                    select(Address).where(Address.user_id == actor.id)
                )
            ).all()
            for item in rows:
                item.is_default = False
        if identifier:
            address = require_found(
                await self.db.scalar(
                    select(Address).where(
                        Address.id == identifier, Address.user_id == actor.id
                    )
                ),
                "Address",
            )
            for key, value in payload.model_dump().items():
                setattr(address, key, value)
        else:
            address = Address(user_id=actor.id, **payload.model_dump())
            self.db.add(address)
        await self.db.commit()
        return address
