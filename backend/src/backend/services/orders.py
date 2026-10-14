import hashlib
import json
import secrets
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exception import AuthorizationError, ConflictError, ValidationError
from backend.models.auth import User
from backend.models.commerce import (
    Allocation,
    CartItem,
    Coupon,
    Notification,
    Order,
    OrderItem,
    Payment,
    Product,
    Reservation,
    ReturnRequest,
    Setting,
    Shipment,
    Stock,
    StockMovement,
    Variant,
    Warehouse,
)
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    CheckoutInput,
    OrderItemResponse,
    OrderResponse,
    QuoteResponse,
    Record,
    ReturnInput,
)
from backend.schemas.inventory import ReservationCreate
from backend.services.cart import CartService
from backend.services.common import audit, record, require_found, utc
from backend.services.inventory import InventoryService

CENT = Decimal("0.01")
TRANSITIONS: dict[str, set[str]] = {
    "pending_payment": {"paid", "cancelled"},
    "paid": {"processing", "cancelled"},
    "awaiting_stock": {"processing", "cancelled"},
    "awaiting_release": {"processing", "cancelled"},
    "processing": {"packed", "cancelled"},
    "packed": {"shipped", "cancelled"},
    "shipped": {"delivered"},
    "delivered": {"returned"},
    "returned": {"refunded"},
    "refunded": set(),
    "cancelled": set(),
}


class OrderService:
    def __init__(self, db: AsyncSession, reservation_minutes: int = 15) -> None:
        self.db = db
        self.inventory = InventoryService(db, reservation_minutes)

    async def view(self, order: Order) -> OrderResponse:
        items = (
            await self.db.scalars(
                select(OrderItem)
                .where(OrderItem.order_id == order.id)
                .order_by(OrderItem.created_at)
            )
        ).all()
        return OrderResponse.model_validate(
            {
                **{
                    name: getattr(order, name)
                    for name in OrderResponse.model_fields
                    if name != "items"
                },
                "items": [OrderItemResponse.model_validate(item) for item in items],
            }
        )

    async def owned(
        self, identifier: UUID, actor: UserResponse, lock: bool = False
    ) -> Order:
        order = require_found(await Order.get(self.db, identifier, lock), "Order")
        if order.user_id != actor.id and actor.role not in ("admin", "staff"):
            raise AuthorizationError("This order belongs to another account.")
        if (
            order.user_id != actor.id
            and actor.role == "staff"
            and "orders.manage" not in actor.permissions
        ):
            raise AuthorizationError("Order management permission is required.")
        return order

    async def hold_cart(self, actor: UserResponse) -> list[Reservation]:
        await self.inventory.expire()
        cart = await CartService(self.db).get(actor, None)
        existing = (
            await self.db.scalars(
                select(Reservation).where(
                    Reservation.cart_id == cart.id, Reservation.status == "active"
                )
            )
        ).all()
        if existing:
            return list(existing)
        items = (
            await self.db.scalars(select(CartItem).where(CartItem.cart_id == cart.id))
        ).all()
        if not items:
            raise ValidationError("Your cart is empty.")
        holds: list[Reservation] = []
        for item in sorted(items, key=lambda item: str(item.variant_id)):
            variant = require_found(
                await self.db.get(Variant, item.variant_id), "Variant"
            )
            product = require_found(
                await self.db.get(Product, variant.product_id), "Product"
            )
            remaining = item.quantity
            stocks = (
                await self.db.scalars(
                    select(Stock)
                    .join(Warehouse)
                    .where(
                        Stock.variant_id == item.variant_id, Warehouse.active.is_(True)
                    )
                    .order_by(Stock.id)
                    .with_for_update()
                )
            ).all()
            for stock in stocks:
                quantity = min(
                    remaining, stock.quantity_on_hand - stock.quantity_reserved
                )
                if quantity:
                    holds.append(
                        await self.inventory.reserve(
                            ReservationCreate(
                                stock_id=stock.id, quantity=quantity, cart_id=cart.id
                            ),
                            actor,
                            commit=False,
                        )
                    )
                    remaining -= quantity
                if not remaining:
                    break
            if remaining and not (product.allow_backorder or product.preorder):
                raise ConflictError(f"Not enough stock for {product.name}.")
        await self.db.commit()
        return holds

    async def prices(
        self,
        subtotal: Decimal,
        delivery: str,
        coupon_code: str | None,
        consume: bool = False,
    ) -> QuoteResponse:
        delivery_setting = await self.db.scalar(
            select(Setting).where(Setting.key == "shipping_standard")
        )
        shipping = (
            Decimal(str(delivery_setting.value))
            if delivery_setting
            else Decimal("100.00")
        )
        if delivery == "express":
            shipping += Decimal("100.00")
        free_threshold = await self.db.scalar(
            select(Setting).where(Setting.key == "free_shipping_threshold")
        )
        threshold = (
            Decimal(str(free_threshold.value)) if free_threshold else Decimal("2500.00")
        )
        if subtotal >= threshold:
            shipping = Decimal("0.00")
        discount = Decimal("0.00")
        code: str | None = None
        if coupon_code:
            code = coupon_code.upper()
            coupon = require_found(
                await self.db.scalar(
                    select(Coupon).where(Coupon.code == code).with_for_update()
                ),
                "Coupon",
            )
            now = datetime.now(UTC)
            if (
                not coupon.active
                or (coupon.starts_at and utc(coupon.starts_at) > now)
                or (coupon.expires_at and utc(coupon.expires_at) <= now)
                or (coupon.max_uses is not None and coupon.uses >= coupon.max_uses)
                or subtotal < coupon.min_spend
            ):
                raise ConflictError(
                    "This coupon is unavailable or its conditions are not met."
                )
            if coupon.kind == "percentage":
                discount = (subtotal * coupon.value / 100).quantize(CENT)
            elif coupon.kind == "fixed":
                discount = min(coupon.value, subtotal)
            elif coupon.kind == "free_shipping":
                shipping = Decimal("0.00")
            discount = min(discount, subtotal)
            if consume:
                coupon.uses += 1
        if subtotal - discount + shipping > Decimal("9999999999.99"):
            raise ValidationError("This order exceeds the supported total amount.")
        return QuoteResponse(
            subtotal=subtotal,
            shipping=shipping,
            discount=discount,
            total=(subtotal - discount + shipping).quantize(CENT),
            coupon_code=code,
        )

    async def create(
        self, payload: CheckoutInput, actor: UserResponse
    ) -> OrderResponse:
        await self.inventory.expire()
        request_hash = hashlib.sha256(
            json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
        ).hexdigest()
        existing = await self.db.scalar(
            select(Order)
            .where(
                Order.user_id == actor.id,
                Order.idempotency_key == payload.idempotency_key,
            )
            .with_for_update()
        )
        if existing:
            if existing.request_hash != request_hash:
                raise ConflictError(
                    "This idempotency key was used for a different checkout request."
                )
            return await self.view(existing)
        cart = await CartService(self.db).get(actor, None)
        cart_items = (
            await self.db.scalars(
                select(CartItem)
                .where(CartItem.cart_id == cart.id)
                .order_by(CartItem.variant_id)
            )
        ).all()
        if not cart_items:
            raise ValidationError("Your cart is empty.")
        products: dict[UUID, tuple[Variant, Product]] = {}
        subtotal = Decimal("0.00")
        for item in cart_items:
            variant = require_found(
                await self.db.get(Variant, item.variant_id), "Variant"
            )
            product = require_found(
                await self.db.get(Product, variant.product_id), "Product"
            )
            if not variant.active or not product.active:
                raise ConflictError(f"{product.name} is no longer available.")
            products[item.id] = (variant, product)
            subtotal += variant.price * item.quantity
        prices = await self.prices(
            subtotal, payload.delivery, payload.coupon_code, consume=True
        )
        shipping, discount, code = prices.shipping, prices.discount, prices.coupon_code
        order = Order(
            number="PP-"
            + datetime.now(UTC).strftime("%y%m%d")
            + "-"
            + secrets.token_hex(4).upper(),
            user_id=actor.id,
            idempotency_key=payload.idempotency_key,
            request_hash=request_hash,
            status="processing"
            if payload.payment_method == "cod"
            else "pending_payment",
            payment_status="unpaid",
            payment_method=payload.payment_method,
            subtotal=subtotal,
            discount=discount,
            shipping=shipping,
            total=(subtotal - discount + shipping).quantize(CENT),
            address=payload.address.model_dump(mode="json"),
            delivery=payload.delivery,
            coupon_code=code,
        )
        self.db.add(order)
        await self.db.flush()
        all_allocated = True
        for item in cart_items:
            variant, product = products[item.id]
            line = OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                product_name=product.name,
                variant_name=variant.name,
                sku=variant.sku,
                image=variant.image
                or (
                    product.images[0]
                    if product.images
                    else "/images/stationery-fallback.webp"
                ),
                quantity=item.quantity,
                allocated=0,
                unit_price=variant.price,
                total=variant.price * item.quantity,
            )
            self.db.add(line)
            await self.db.flush()
            remaining = item.quantity
            holds = (
                await self.db.scalars(
                    select(Reservation)
                    .where(
                        Reservation.cart_id == cart.id,
                        Reservation.variant_id == variant.id,
                        Reservation.status == "active",
                    )
                    .order_by(Reservation.stock_id)
                    .with_for_update()
                )
            ).all()
            for hold in holds:
                stock = require_found(
                    await Stock.get(self.db, hold.stock_id, lock=True), "Stock"
                )
                take = min(remaining, hold.quantity)
                stock.quantity_reserved -= hold.quantity
                stock.quantity_on_hand -= take
                hold.status = "completed" if take else "cancelled"
                hold.order_id = order.id
                if take:
                    self.db.add(
                        Allocation(
                            order_item_id=line.id, stock_id=stock.id, quantity=take
                        )
                    )
                    self.db.add(
                        StockMovement(
                            stock_id=stock.id,
                            delta=-take,
                            kind="order",
                            reason=f"Order {order.number}",
                            actor_id=actor.id,
                            reference=str(order.id),
                        )
                    )
                    line.allocated += take
                    remaining -= take
                await self.inventory.synchronize_alert(stock)
            stocks = (
                await self.db.scalars(
                    select(Stock)
                    .join(Warehouse)
                    .where(Stock.variant_id == variant.id, Warehouse.active.is_(True))
                    .order_by(Stock.id)
                    .with_for_update()
                )
            ).all()
            for stock in stocks:
                take = min(remaining, stock.quantity_on_hand - stock.quantity_reserved)
                if take:
                    stock.quantity_on_hand -= take
                    self.db.add(
                        Allocation(
                            order_item_id=line.id, stock_id=stock.id, quantity=take
                        )
                    )
                    self.db.add(
                        StockMovement(
                            stock_id=stock.id,
                            delta=-take,
                            kind="order",
                            reason=f"Order {order.number}",
                            actor_id=actor.id,
                            reference=str(order.id),
                        )
                    )
                    line.allocated += take
                    remaining -= take
                    await self.inventory.synchronize_alert(stock)
                if not remaining:
                    break
            if remaining:
                if not (product.allow_backorder or product.preorder):
                    raise ConflictError(f"Not enough stock for {product.name}.")
                all_allocated = False
        if payload.payment_method == "cod":
            if not all_allocated:
                order.status = "awaiting_stock"
            elif not await self.release_ready(order):
                order.status = "awaiting_release"
        self.db.add(
            Payment(
                order_id=order.id,
                provider=payload.payment_method,
                status="unpaid",
                amount=order.total,
            )
        )
        await self.db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
        self.db.add(
            Notification(
                user_id=actor.id,
                recipient=actor.email,
                subject=f"Your order {order.number}",
                body=f"Thank you for your order.\nTotal: NPR {order.total}\nStatus: {order.status}\nView your order: /account/orders/{order.id}",
            )
        )
        await audit(self.db, actor, "checkout", "orders", order.id)
        await self.db.commit()
        return await self.view(order)

    async def release_ready(self, order: Order) -> bool:
        lines = (
            await self.db.scalars(
                select(OrderItem).where(OrderItem.order_id == order.id)
            )
        ).all()
        for line in lines:
            if line.allocated < line.quantity:
                return False
            variant = require_found(
                await self.db.get(Variant, line.variant_id), "Variant"
            )
            product = require_found(
                await self.db.get(Product, variant.product_id), "Product"
            )
            if product.preorder and (
                product.release_date is None
                or utc(product.release_date) > datetime.now(UTC)
            ):
                return False
        return True

    async def release(self, order: Order, actor: UserResponse | None) -> None:
        if order.stock_released:
            return
        lines = (
            await self.db.scalars(
                select(OrderItem).where(OrderItem.order_id == order.id)
            )
        ).all()
        for line in lines:
            allocations = (
                await self.db.scalars(
                    select(Allocation)
                    .where(
                        Allocation.order_item_id == line.id,
                        Allocation.released.is_(False),
                    )
                    .order_by(Allocation.stock_id)
                    .with_for_update()
                )
            ).all()
            for allocation in allocations:
                stock = require_found(
                    await Stock.get(self.db, allocation.stock_id, lock=True), "Stock"
                )
                stock.quantity_on_hand += allocation.quantity
                allocation.released = True
                self.db.add(
                    StockMovement(
                        stock_id=stock.id,
                        delta=allocation.quantity,
                        kind="order_release",
                        reason=f"Order {order.number} cancelled/returned",
                        actor_id=actor.id if actor else None,
                        reference=str(order.id),
                    )
                )
                await self.inventory.synchronize_alert(stock)
            line.allocated = 0
        order.stock_released = True

    async def transition(
        self,
        order: Order,
        status: str,
        actor: UserResponse,
        tracking: str | None = None,
        notes: str | None = None,
    ) -> OrderResponse:
        await self.inventory.lock()
        await self.db.refresh(order, with_for_update=True)
        if order.status == status:
            if tracking is not None:
                order.tracking_number = tracking
            if notes is not None:
                order.notes = notes
            await audit(self.db, actor, "details", "orders", order.id)
            await self.db.commit()
            return await self.view(order)
        if status not in TRANSITIONS.get(order.status, set()):
            raise ConflictError(
                f"Cannot change an order from {order.status} to {status}."
            )
        if status in (
            "processing",
            "packed",
            "shipped",
            "delivered",
        ) and not await self.release_ready(order):
            raise ConflictError(
                "This order must have fully allocated stock and released preorders before fulfillment."
            )
        if status == "paid":
            raise ValidationError(
                "Payments must be confirmed through provider verification."
            )
        if status in ("cancelled", "returned"):
            await self.release(order, actor)
        if status == "refunded":
            # Online refunds need an actual provider refund confirmation, never a fake status.
            if order.payment_method != "cod":
                raise ConflictError(
                    "Confirm the refund with the payment provider before marking this online order refunded."
                )
            order.payment_status = "refunded"
        if status == "delivered" and order.payment_method == "cod":
            order.payment_status = "paid"
            payment = await self.db.scalar(
                select(Payment).where(Payment.order_id == order.id)
            )
            if payment:
                payment.status = "paid"
                payment.verified_at = datetime.now(UTC)
        if status in ("shipped", "delivered"):
            shipment = await self.db.scalar(
                select(Shipment).where(Shipment.order_id == order.id)
            )
            if shipment is None:
                shipment = Shipment(
                    order_id=order.id,
                    status=status,
                    tracking_number=tracking or order.tracking_number,
                )
                self.db.add(shipment)
            shipment.status = status
            if tracking is not None:
                shipment.tracking_number = tracking
            if status == "delivered":
                shipment.delivered_at = datetime.now(UTC)
        order.status = status
        if tracking is not None:
            order.tracking_number = tracking
        if notes is not None:
            order.notes = notes
        self.db.add(
            Notification(
                user_id=order.user_id,
                recipient=require_found(
                    await self.db.get(User, order.user_id), "Customer"
                ).email,
                subject=f"Order {order.number}: {status}",
                body=f"Your order is now {status}.\nTracking: {order.tracking_number or 'Not assigned'}",
            )
        )
        await audit(self.db, actor, "status", "orders", order.id, {"status": status})
        await self.db.commit()
        return await self.view(order)

    async def cancel(self, identifier: UUID, actor: UserResponse) -> OrderResponse:
        await self.inventory.lock()
        order = await self.owned(identifier, actor, lock=True)
        if order.status == "cancelled":
            return await self.view(order)
        if actor.role == "customer" and order.status not in (
            "pending_payment",
            "awaiting_stock",
            "awaiting_release",
            "processing",
            "paid",
        ):
            raise ConflictError(
                "This order can no longer be cancelled; request a return after delivery."
            )
        return await self.transition(order, "cancelled", actor)

    async def allocate_backorders(self) -> None:
        await self.inventory.lock()
        orders = (
            await self.db.scalars(
                select(Order)
                .where(
                    Order.status.in_(
                        [
                            "awaiting_stock",
                            "awaiting_release",
                            "paid",
                            "pending_payment",
                        ]
                    )
                )
                .order_by(Order.created_at, Order.id)
                .with_for_update()
            )
        ).all()
        for order in orders:
            lines = (
                await self.db.scalars(
                    select(OrderItem)
                    .where(OrderItem.order_id == order.id)
                    .order_by(OrderItem.variant_id)
                )
            ).all()
            for line in lines:
                remaining = line.quantity - line.allocated
                stocks = (
                    await self.db.scalars(
                        select(Stock)
                        .join(Warehouse)
                        .where(
                            Stock.variant_id == line.variant_id,
                            Warehouse.active.is_(True),
                        )
                        .order_by(Stock.id)
                        .with_for_update()
                    )
                ).all()
                for stock in stocks:
                    take = min(
                        remaining, stock.quantity_on_hand - stock.quantity_reserved
                    )
                    if take:
                        stock.quantity_on_hand -= take
                        line.allocated += take
                        remaining -= take
                        self.db.add(
                            Allocation(
                                order_item_id=line.id, stock_id=stock.id, quantity=take
                            )
                        )
                        self.db.add(
                            StockMovement(
                                stock_id=stock.id,
                                delta=-take,
                                kind="backorder_allocation",
                                reason=f"FIFO allocation for {order.number}",
                                reference=str(order.id),
                            )
                        )
                        await self.inventory.synchronize_alert(stock)
                    if not remaining:
                        break
            if all(
                line.allocated == line.quantity for line in lines
            ) and order.status in ("awaiting_stock", "awaiting_release"):
                if not await self.release_ready(order):
                    order.status = "awaiting_release"
                    continue
                order.status = "processing"
                user = require_found(await self.db.get(User, order.user_id), "Customer")
                self.db.add(
                    Notification(
                        user_id=user.id,
                        recipient=user.email,
                        subject=f"Order {order.number} is ready",
                        body="All items are now allocated and your order is being prepared.",
                    )
                )

    async def orders(self, actor: UserResponse) -> list[OrderResponse]:
        rows = (
            await self.db.scalars(
                select(Order)
                .where(Order.user_id == actor.id)
                .order_by(Order.created_at.desc())
            )
        ).all()
        return [await OrderService(self.db).view(row) for row in rows]

    async def request_return(
        self, identifier: UUID, payload: ReturnInput, actor: UserResponse
    ) -> Record:
        order = await OrderService(self.db).owned(identifier, actor)
        if order.status != "delivered":
            raise ConflictError("Only delivered orders may be returned.")
        existing = await self.db.scalar(
            select(ReturnRequest).where(ReturnRequest.order_id == identifier)
        )
        if existing:
            return record(existing)
        row = ReturnRequest(
            order_id=identifier, user_id=actor.id, reason=payload.reason
        )
        self.db.add(row)
        await self.db.commit()
        return record(row)
