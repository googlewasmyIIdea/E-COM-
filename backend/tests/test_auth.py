from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.main import app
from backend.models.auth import AuthSession, User
from backend.models.base import Base
from backend.schemas.auth import LoginRequest
from backend.services.auth import AuthService, hash_token


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_session() -> AsyncIterator[AsyncSession]:
        yield db

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        database_url="sqlite+aiosqlite:///:memory:", _env_file=None
    )
    await AuthService(db, 8).create_user("owner@example.com", "a-long-test-password")
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as http:
            yield http
    finally:
        app.dependency_overrides.clear()


async def login(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "OWNER@example.com", "password": "a-long-test-password"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "owner@example.com"
    assert "password" not in payload["user"]
    assert datetime.fromisoformat(payload["expires_at"]) > datetime.now(UTC)
    return str(payload["session_token"])


@pytest.mark.asyncio
async def test_login_me_and_logout(client: AsyncClient, db: AsyncSession) -> None:
    token = await login(client)
    headers = {"Authorization": f"Bearer {token}"}
    stored = await db.scalar(select(AuthSession))
    assert stored is not None
    assert stored.token_hash == hash_token(token)
    assert stored.token_hash != token
    user = await db.scalar(select(User))
    assert user is not None
    assert user.password_hash != "a-long-test-password"
    assert user.password_hash.startswith("$argon2id$")
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "owner@example.com"
    assert (
        await client.get("/api/v1/inventory/stock", headers=headers)
    ).status_code == 403
    assert (
        await client.post("/api/v1/auth/logout", headers=headers)
    ).status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("email", ["owner@example.com", "missing@example.com"])
async def test_invalid_credentials(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "incorrect"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
    assert "no-store" in response.headers["cache-control"]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/v1/auth/me", "/api/v1/inventory/stock"])
async def test_missing_and_forged_tokens(client: AsyncClient, path: str) -> None:
    for headers in ({}, {"Authorization": "Bearer forged-token"}):
        response = await client.get(path, headers=headers)
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_expired_session(client: AsyncClient, db: AsyncSession) -> None:
    token = await login(client)
    stored = await db.scalar(select(AuthSession))
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db.commit()
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_disabled_user(client: AsyncClient, db: AsyncSession) -> None:
    token = await login(client)
    user = await db.scalar(select(User))
    assert user is not None
    user.is_active = False
    await db.commit()
    assert (
        await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "a-long-test-password"},
        )
    ).status_code == 401


@pytest.mark.asyncio
async def test_input_validation(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": "not-an-email", "password": ""}
    )
    assert response.status_code == 422
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "x" * 1025},
    )
    assert response.status_code == 422


def test_password_is_not_in_validation_errors() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as error:
        LoginRequest(email="invalid", password="private-password")
    assert "private-password" not in str(error.value)


@pytest.mark.asyncio
async def test_duplicate_account(db: AsyncSession) -> None:
    from backend.core.exception import ConflictError

    service = AuthService(db, 8)
    await service.create_user("owner@example.com", "a-long-test-password")
    with pytest.raises(ConflictError):
        await service.create_user("OWNER@example.com", "a-long-test-password")


@pytest.mark.asyncio
async def test_six_character_password_can_create_account_and_login(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    await AuthService(db, 8).create_user("short@example.com", "sixpwd")
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "short@example.com", "password": "sixpwd"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "short@example.com"


@pytest.mark.asyncio
@pytest.mark.parametrize("password", ["", "abcde", "x" * 1025])
async def test_account_password_outside_allowed_length_is_rejected(
    db: AsyncSession,
    password: str,
) -> None:
    with pytest.raises(ValueError, match="between 6 and 1024"):
        await AuthService(db, 8).create_user("short@example.com", password)
    assert await User.by_email(db, "short@example.com") is None
