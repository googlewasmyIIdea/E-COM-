from decimal import Decimal

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import Settings
from backend.core.exception import ConflictError, ServiceUnavailableError
from backend.models.auth import User
from backend.models.commerce import Order, Payment
from backend.schemas.auth import UserResponse
from backend.services.payments import PaymentService


async def payment_order(db: AsyncSession) -> tuple[Order, UserResponse]:
    user = User(email="payment@example.com", password_hash="unused", role="customer")
    db.add(user)
    await db.flush()
    order = Order(
        number="PP-PAYMENT-TEST",
        user_id=user.id,
        idempotency_key="payment-test-key-123",
        request_hash="0" * 64,
        status="pending_payment",
        payment_status="unpaid",
        payment_method="khalti",
        subtotal=Decimal("500"),
        discount=Decimal("0"),
        shipping=Decimal("100"),
        total=Decimal("600"),
        address={"name": "Test"},
        delivery="standard",
    )
    db.add(order)
    await db.flush()
    db.add(
        Payment(
            order_id=order.id,
            provider="khalti",
            reference="test-pidx",
            status="pending",
            amount=order.total,
        )
    )
    await db.commit()
    return order, UserResponse(id=user.id, email=user.email)


@pytest.mark.asyncio
async def test_missing_credentials_do_not_simulate_payment(
    commerce_db: AsyncSession,
) -> None:
    order, actor = await payment_order(commerce_db)
    async with httpx.AsyncClient() as http:
        with pytest.raises(ServiceUnavailableError):
            await PaymentService(commerce_db, Settings(_env_file=None), http).initiate(
                order.id, actor
            )
    assert order.payment_status == "unpaid"


@pytest.mark.asyncio
async def test_verified_payment_is_idempotent(commerce_db: AsyncSession) -> None:
    order, actor = await payment_order(commerce_db)

    def response(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/epayment/lookup/")
        assert request.headers["Authorization"] == "Key test-key"
        return httpx.Response(
            200,
            json={
                "pidx": "test-pidx",
                "status": "Completed",
                "total_amount": 60000,
                "transaction_id": "real-provider-transaction",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as http:
        service = PaymentService(
            commerce_db, Settings(khalti_secret_key="test-key", _env_file=None), http
        )
        for _ in range(2):
            result = await service.verify(order.id, "test-pidx", actor)
            assert result.verified
    assert order.payment_status == "paid"


@pytest.mark.asyncio
async def test_payment_amount_mismatch_is_rejected(commerce_db: AsyncSession) -> None:
    order, actor = await payment_order(commerce_db)

    def response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "pidx": "test-pidx",
                "status": "Completed",
                "total_amount": 1,
                "transaction_id": "txn",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as http:
        service = PaymentService(
            commerce_db, Settings(khalti_secret_key="test-key", _env_file=None), http
        )
        with pytest.raises(ConflictError):
            await service.verify(order.id, "test-pidx", actor)
    assert order.payment_status == "unpaid"


@pytest.mark.asyncio
async def test_pending_provider_status_never_marks_paid(
    commerce_db: AsyncSession,
) -> None:
    order, actor = await payment_order(commerce_db)
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"pidx": "test-pidx", "status": "Pending", "total_amount": 60000},
            )
        )
    ) as http:
        result = await PaymentService(
            commerce_db, Settings(khalti_secret_key="test-key", _env_file=None), http
        ).verify(order.id, "test-pidx", actor)
        assert not result.verified
    assert order.payment_status == "unpaid"
