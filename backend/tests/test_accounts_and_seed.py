import re

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.commerce import Notification, Product, Stock
from backend.seed import seed_catalog


@pytest.mark.asyncio
async def test_development_seed_is_idempotent_and_preserves_stock(
    commerce_db: AsyncSession,
) -> None:
    await seed_catalog(commerce_db)
    assert await commerce_db.scalar(select(func.count()).select_from(Product)) == 54
    stock = (await commerce_db.scalars(select(Stock))).first()
    assert stock is not None
    stock.quantity_on_hand = 7
    await commerce_db.commit()
    await seed_catalog(commerce_db)
    assert await commerce_db.scalar(select(func.count()).select_from(Product)) == 54
    assert stock.quantity_on_hand == 7


@pytest.mark.asyncio
async def test_registration_requires_stronger_password(api: AsyncClient) -> None:
    for password in ["sixpwd", "abcdefghijk", "12345678900"]:
        response = await api.post(
            "/api/v1/auth/register",
            json={"email": "new@example.com", "name": "New", "password": password},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_password_reset_consumes_token_and_revokes_sessions(
    api: AsyncClient, customer: dict[str, str], commerce_db: AsyncSession
) -> None:
    response = await api.post(
        "/api/v1/auth/password/forgot", json={"email": "customer@example.com"}
    )
    assert response.status_code == 200
    notification = await commerce_db.scalar(select(Notification))
    assert notification is not None
    match = re.search(r"token=([A-Za-z0-9_-]+)", notification.body)
    assert match is not None
    token = match.group(1)
    request = {"token": token, "password": "NewPassword123"}
    assert (
        await api.post("/api/v1/auth/password/reset", json=request)
    ).status_code == 200
    assert (await api.get("/api/v1/auth/me", headers=customer)).status_code == 401
    assert (
        await api.post("/api/v1/auth/password/reset", json=request)
    ).status_code == 400
    assert (
        await api.post(
            "/api/v1/auth/login",
            json={"email": "customer@example.com", "password": "NewPassword123"},
        )
    ).status_code == 200


@pytest.mark.asyncio
async def test_profile_cannot_change_role(
    api: AsyncClient, customer: dict[str, str]
) -> None:
    response = await api.patch(
        "/api/v1/account/profile", headers=customer, json={"role": "admin"}
    )
    assert response.status_code == 422
    response = await api.patch(
        "/api/v1/account/profile",
        headers=customer,
        json={"name": "Updated customer", "preferences": {"newsletter": False}},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated customer"
    assert response.json()["role"] == "customer"


def test_seed_entrypoint_registers_authentication_tables() -> None:
    import subprocess
    import sys

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import backend.seed; from backend.models.base import Base; assert 'users' in Base.metadata.tables",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.asyncio
async def test_login_throttles_repeated_invalid_passwords(
    api: AsyncClient, customer: dict[str, str]
) -> None:
    for _ in range(5):
        response = await api.post(
            "/api/v1/auth/login",
            json={"email": "customer@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401
    response = await api.post(
        "/api/v1/auth/login",
        json={"email": "customer@example.com", "password": "legacy-password"},
    )
    assert response.status_code == 429
    assert (await api.get("/api/v1/auth/me", headers=customer)).status_code == 200


@pytest.mark.asyncio
async def test_account_preference_unsubscribes_newsletter(
    api: AsyncClient, customer: dict[str, str], commerce_db: AsyncSession
) -> None:
    from backend.models.commerce import Newsletter

    await api.post(
        "/api/v1/newsletter", json={"email": "customer@example.com", "consent": True}
    )
    assert (
        await api.patch(
            "/api/v1/account/profile",
            headers=customer,
            json={"preferences": {"newsletter": False}},
        )
    ).status_code == 200
    row = await commerce_db.scalar(
        select(Newsletter).where(Newsletter.email == "customer@example.com")
    )
    assert row is not None and not row.active and not row.consent
