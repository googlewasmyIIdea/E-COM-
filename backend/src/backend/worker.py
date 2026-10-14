"""Database-authoritative reservation expiry and transactional notification delivery."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from backend.core.config import Settings
from backend.models.commerce import Order, Payment
from backend.services.inventory import InventoryService
from backend.services.notifications import NotificationService
from backend.services.orders import OrderService

logger = logging.getLogger(__name__)


async def maintenance(engine: AsyncEngine, settings: Settings) -> None:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        inventory = InventoryService(db, settings.reservation_minutes)
        await inventory.expire()
        await OrderService(db).allocate_backorders()
        # Unpaid online checkouts cannot hold stock indefinitely.
        stale = (
            await db.scalars(
                select(Order)
                .where(
                    Order.status == "pending_payment",
                    Order.payment_status == "unpaid",
                    Order.created_at < datetime.now(UTC) - timedelta(minutes=30),
                )
                .order_by(Order.id)
                .with_for_update()
            )
        ).all()
        for order in stale:
            await OrderService(db).release(order, None)
            order.status = "cancelled"
            payment = await db.scalar(
                select(Payment).where(Payment.order_id == order.id)
            )
            if payment:
                payment.status = "expired"
        await db.commit()
    async with factory() as db:
        await NotificationService(db, settings).deliver_pending()


async def run_worker(engine: AsyncEngine, settings: Settings) -> None:
    while True:
        try:
            await maintenance(engine, settings)
        except (SQLAlchemyError, OSError):
            # Avoid logging SQL parameters that could contain private notification links.
            logger.error("Commerce maintenance failed; retrying on the next interval.")
        await asyncio.sleep(20)
