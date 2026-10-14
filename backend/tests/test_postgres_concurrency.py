"""Run explicitly with RUN_POSTGRES_TESTS=1; isolated schema, never reset public data."""

import asyncio
import os
from collections.abc import AsyncIterator
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from backend.core.config import get_settings
from backend.core.exception import ConflictError
from backend.models.auth import User
from backend.models.base import Base
from backend.models.commerce import Product, Stock, Variant, Warehouse
from backend.schemas.auth import UserResponse
from backend.schemas.inventory import ReservationCreate, StockAdjustment
from backend.services.inventory import InventoryService

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1",
    reason="Explicit opt-in required for PostgreSQL integration tests",
)


@pytest_asyncio.fixture
async def pg_engine() -> AsyncIterator[AsyncEngine]:
    schema = "commerce_test_" + uuid4().hex
    url = get_settings().database_url
    control = create_async_engine(url)
    async with control.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(
        url, connect_args={"server_settings": {"search_path": schema}}
    )
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        yield engine
    finally:
        await engine.dispose()
        async with control.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await control.dispose()


async def setup(engine: AsyncEngine) -> tuple[UserResponse, ReservationCreate]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        user = User(
            email="concurrency@example.com", password_hash="not-used", role="admin"
        )
        product = Product(name="Concurrency test journal", slug="concurrency-journal")
        warehouse = Warehouse(
            name="Isolated test warehouse", code="TEST", location="Test"
        )
        db.add_all([user, product, warehouse])
        await db.flush()
        variant = Variant(
            product_id=product.id,
            sku="CONCURRENCY-SKU",
            name="Test",
            price=Decimal("10"),
        )
        db.add(variant)
        await db.flush()
        stock = Stock(
            warehouse_id=warehouse.id,
            variant_id=variant.id,
            quantity_on_hand=1,
            quantity_reserved=0,
            reorder_point=0,
        )
        db.add(stock)
        await db.commit()
        return UserResponse(
            id=user.id, email=user.email, role="admin"
        ), ReservationCreate(stock_id=stock.id, quantity=1)


@pytest.mark.asyncio
async def test_concurrent_reservations_never_oversell(pg_engine: AsyncEngine) -> None:
    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)

    async def attempt() -> str:
        async with factory() as db:
            try:
                await InventoryService(db).reserve(request, actor)
                return "reserved"
            except ConflictError:
                await db.rollback()
                return "unavailable"

    outcomes = await asyncio.gather(attempt(), attempt())
    assert sorted(outcomes) == ["reserved", "unavailable"]
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert (
            stock is not None
            and stock.quantity_reserved == 1
            and stock.quantity_on_hand == 1
        )


@pytest.mark.asyncio
async def test_concurrent_cancellation_releases_once(pg_engine: AsyncEngine) -> None:
    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)
    async with factory() as db:
        hold = await InventoryService(db).reserve(request, actor)
        identifier = hold.id

    async def cancel() -> None:
        async with factory() as db:
            await InventoryService(db).cancel_reservation(identifier, actor)

    await asyncio.gather(cancel(), cancel())
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert (
            stock is not None
            and stock.quantity_reserved == 0
            and stock.quantity_on_hand == 1
        )


@pytest.mark.asyncio
async def test_concurrent_decrements_never_make_stock_negative(
    pg_engine: AsyncEngine,
) -> None:
    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)

    async def decrement() -> str:
        async with factory() as db:
            try:
                await InventoryService(db).adjust(
                    request.stock_id,
                    StockAdjustment(delta=-1, reason="Concurrent adjustment"),
                    actor,
                )
                return "adjusted"
            except ConflictError:
                await db.rollback()
                return "unavailable"

    assert sorted(await asyncio.gather(decrement(), decrement())) == [
        "adjusted",
        "unavailable",
    ]


@pytest.mark.asyncio
async def test_concurrent_admin_order_cancellation_releases_stock_once(
    pg_engine: AsyncEngine,
) -> None:
    from backend.models.commerce import CartItem, Order
    from backend.schemas.commerce import AddressInput, CheckoutInput
    from backend.services.cart import CartService
    from backend.services.orders import OrderService

    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert stock is not None
        cart = await CartService(db).get(actor, None)
        db.add(CartItem(cart_id=cart.id, variant_id=stock.variant_id, quantity=1))
        await db.commit()
        order = await OrderService(db).create(
            CheckoutInput(
                address=AddressInput(
                    name="QA",
                    phone="9800000000",
                    line1="Test street",
                    city="Kathmandu",
                    country="NP",
                ),
                payment_method="cod",
                idempotency_key="pg-cancel-order-once-123",
            ),
            actor,
        )
        identifier = order.id
    ready = asyncio.Event()
    loaded = 0

    async def cancel() -> None:
        nonlocal loaded
        async with factory() as db:
            target = await db.get(Order, identifier)
            assert target is not None
            loaded += 1
            if loaded == 2:
                ready.set()
            await ready.wait()
            await OrderService(db).transition(target, "cancelled", actor)

    await asyncio.gather(cancel(), cancel())
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert stock is not None and stock.quantity_on_hand == 1


@pytest.mark.asyncio
async def test_stale_admin_request_cannot_cancel_a_delivered_order(
    pg_engine: AsyncEngine,
) -> None:
    from backend.models.commerce import CartItem, Order
    from backend.schemas.commerce import AddressInput, CheckoutInput
    from backend.services.cart import CartService
    from backend.services.orders import OrderService

    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert stock is not None
        cart = await CartService(db).get(actor, None)
        db.add(CartItem(cart_id=cart.id, variant_id=stock.variant_id, quantity=1))
        await db.commit()
        order = await OrderService(db).create(
            CheckoutInput(
                address=AddressInput(
                    name="QA",
                    phone="9800000000",
                    line1="Test street",
                    city="Kathmandu",
                    country="NP",
                ),
                payment_method="cod",
                idempotency_key="pg-stale-order-state-123",
            ),
            actor,
        )
        identifier = order.id
    async with factory() as stale_db:
        stale = await stale_db.get(Order, identifier)
        assert stale is not None
        async with factory() as current_db:
            current = await current_db.get(Order, identifier)
            assert current is not None
            for status in ("packed", "shipped", "delivered"):
                await OrderService(current_db).transition(current, status, actor)
        with pytest.raises(ConflictError):
            await OrderService(stale_db).transition(stale, "cancelled", actor)
        await stale_db.rollback()
    async with factory() as db:
        current = await db.get(Order, identifier)
        stock = await db.get(Stock, request.stock_id)
        assert current is not None and current.status == "delivered"
        assert stock is not None and stock.quantity_on_hand == 0


@pytest.mark.asyncio
async def test_concurrent_identical_checkout_creates_one_order(
    pg_engine: AsyncEngine,
) -> None:
    from sqlalchemy import func, select

    from backend.models.commerce import CartItem, Order
    from backend.schemas.commerce import AddressInput, CheckoutInput
    from backend.services.cart import CartService
    from backend.services.orders import OrderService

    actor, request = await setup(pg_engine)
    factory = async_sessionmaker(pg_engine, expire_on_commit=False)
    async with factory() as db:
        stock = await db.get(Stock, request.stock_id)
        assert stock is not None
        cart = await CartService(db).get(actor, None)
        db.add(CartItem(cart_id=cart.id, variant_id=stock.variant_id, quantity=1))
        await db.commit()
    payload = CheckoutInput(
        address=AddressInput(
            name="QA",
            phone="9800000000",
            line1="Test street",
            city="Kathmandu",
            country="NP",
        ),
        payment_method="cod",
        idempotency_key="pg-concurrent-checkout-123",
    )

    async def checkout() -> str:
        async with factory() as db:
            return str((await OrderService(db).create(payload, actor)).id)

    identifiers = await asyncio.gather(checkout(), checkout())
    assert identifiers[0] == identifiers[1]
    async with factory() as db:
        assert await db.scalar(select(func.count(Order.id))) == 1
        stock = await db.get(Stock, request.stock_id)
        assert stock is not None and stock.quantity_on_hand == 0
