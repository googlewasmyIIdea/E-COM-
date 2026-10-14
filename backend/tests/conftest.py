from collections.abc import AsyncIterator
from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.main import app
from backend.models.auth import User
from backend.models.base import Base
from backend.models.commerce import Product  # noqa: F401
from backend.services.auth import AuthService


@pytest_asyncio.fixture
async def commerce_db() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        yield db
    await engine.dispose()


@pytest_asyncio.fixture
async def api(commerce_db: AsyncSession, tmp_path: Path) -> AsyncIterator[AsyncClient]:
    async def session_override() -> AsyncIterator[AsyncSession]:
        yield commerce_db

    settings = Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        mail_dir=str(tmp_path),
        _env_file=None,
    )
    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


async def account(
    api: AsyncClient, db: AsyncSession, email: str, role: str
) -> dict[str, str]:
    await AuthService(db, 8).create_user(email, "legacy-password")
    user = await User.by_email(db, email)
    assert user is not None
    user.role = role
    await db.commit()
    response = await api.post(
        "/api/v1/auth/login", json={"email": email, "password": "legacy-password"}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['session_token']}"}


@pytest_asyncio.fixture
async def admin(api: AsyncClient, commerce_db: AsyncSession) -> dict[str, str]:
    return await account(api, commerce_db, "admin@example.com", "admin")


@pytest_asyncio.fixture
async def customer(api: AsyncClient, commerce_db: AsyncSession) -> dict[str, str]:
    return await account(api, commerce_db, "customer@example.com", "customer")
