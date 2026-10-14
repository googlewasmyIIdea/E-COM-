from datetime import datetime
from uuid import UUID, uuid4

from pydantic import JsonValue
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Uuid,
    delete,
    false,
    select,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), default="customer", server_default="customer", nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(120), default="", server_default="", nullable=False
    )
    phone: Mapped[str] = mapped_column(
        String(32), default="", server_default="", nullable=False
    )
    permissions: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default=text("'[]'"), nullable=False
    )
    preferences: Mapped[dict[str, JsonValue]] = mapped_column(
        JSON, default=dict, server_default=text("'{}'"), nullable=False
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )

    @classmethod
    async def by_email(cls, db: AsyncSession, email: str) -> "User | None":
        result = await db.execute(select(cls).where(cls.email == email))
        return result.scalars().one_or_none()

    @classmethod
    async def create(cls, db: AsyncSession, email: str, password_hash: str) -> "User":
        user = cls(email=email, password_hash=password_hash)
        db.add(user)
        await db.flush()
        return user


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    @classmethod
    async def create(
        cls, db: AsyncSession, token_hash: str, user_id: UUID, expires_at: datetime
    ) -> None:
        db.add(cls(token_hash=token_hash, user_id=user_id, expires_at=expires_at))
        await db.flush()

    @classmethod
    async def authenticated_user(
        cls, db: AsyncSession, token_hash: str, now: datetime
    ) -> User | None:
        result = await db.execute(
            select(User)
            .join(cls, cls.user_id == User.id)
            .where(
                cls.token_hash == token_hash,
                cls.expires_at > now,
                User.is_active.is_(True),
            )
        )

        return result.scalars().one_or_none()

    @classmethod
    async def revoke(cls, db: AsyncSession, token_hash: str) -> None:
        await db.execute(delete(cls).where(cls.token_hash == token_hash))

    @classmethod
    async def clear_expired(cls, db: AsyncSession, now: datetime) -> None:
        await db.execute(delete(cls).where(cls.expires_at <= now))
