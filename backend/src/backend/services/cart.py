from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exception import ConflictError, ValidationError
from backend.models.commerce import Cart, CartItem, Product, Stock, Variant, Warehouse
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import CartAdd, CartItemResponse, CartResponse
from backend.services.auth import hash_token
from backend.services.common import require_found
from backend.services.inventory import InventoryService


class CartService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(
        self, actor: UserResponse | None, guest: str | None, create: bool = True
    ) -> Cart:
        await InventoryService(self.db).lock()
        if actor:
            statement = select(Cart).where(Cart.user_id == actor.id)
        elif guest and len(guest) >= 20:
            statement = select(Cart).where(Cart.guest_hash == hash_token(guest))
        else:
            raise ValidationError("A guest cart identifier is required.")
        cart = await self.db.scalar(statement.with_for_update())
        if cart is None:
            if not create:
                raise ConflictError("Cart does not exist.")
            cart = Cart(
                user_id=actor.id if actor else None,
                guest_hash=hash_token(guest) if guest and not actor else None,
            )
            self.db.add(cart)
            await self.db.flush()
        return cart

    async def available(self, variant_id: UUID) -> int:
        quantity = await self.db.scalar(
            select(func.sum(Stock.quantity_on_hand - Stock.quantity_reserved))
            .join(Warehouse)
            .where(Stock.variant_id == variant_id, Warehouse.active.is_(True))
        )
        return int(quantity or 0)

    async def view(self, cart: Cart) -> CartResponse:
        rows = (
            await self.db.scalars(
                select(CartItem)
                .where(CartItem.cart_id == cart.id)
                .order_by(CartItem.created_at)
            )
        ).all()
        items: list[CartItemResponse] = []
        for row in rows:
            variant = require_found(
                await self.db.get(Variant, row.variant_id), "Variant"
            )
            product = require_found(
                await self.db.get(Product, variant.product_id), "Product"
            )
            items.append(
                CartItemResponse(
                    id=row.id,
                    variant_id=variant.id,
                    product_id=product.id,
                    name=product.name,
                    slug=product.slug,
                    variant_name=variant.name,
                    sku=variant.sku,
                    image=variant.image
                    or (
                        product.images[0]
                        if product.images
                        else "/images/stationery-fallback.webp"
                    ),
                    quantity=row.quantity,
                    price=variant.price,
                    total=variant.price * row.quantity,
                    available_stock=await self.available(variant.id),
                    allow_backorder=product.allow_backorder or product.preorder,
                )
            )
        return CartResponse(
            id=cart.id,
            items=items,
            subtotal=sum((item.total for item in items), Decimal("0.00")),
            count=sum(item.quantity for item in items),
        )

    async def add(self, cart: Cart, payload: CartAdd) -> CartResponse:
        await InventoryService(self.db).expire()
        variant = require_found(
            await self.db.get(Variant, payload.variant_id), "Variant"
        )
        product = require_found(
            await self.db.get(Product, variant.product_id), "Product"
        )
        if not product.active or not variant.active:
            raise ConflictError("This product is unavailable.")
        existing = await self.db.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart.id, CartItem.variant_id == variant.id
            )
        )
        quantity = payload.quantity + (existing.quantity if existing else 0)
        if quantity > 99:
            raise ValidationError("Maximum quantity is 99 per item.")
        if not (
            product.allow_backorder or product.preorder
        ) and quantity > await self.available(variant.id):
            raise ConflictError("Not enough stock for this quantity.")
        if existing:
            existing.quantity = quantity
        else:
            self.db.add(
                CartItem(cart_id=cart.id, variant_id=variant.id, quantity=quantity)
            )
        await self.db.commit()
        return await self.view(cart)

    async def change(
        self, cart: Cart, identifier: UUID, quantity: int | None
    ) -> CartResponse:
        await InventoryService(self.db).expire()
        row = require_found(
            await self.db.scalar(
                select(CartItem).where(
                    CartItem.id == identifier, CartItem.cart_id == cart.id
                )
            ),
            "Cart item",
        )
        if quantity is None:
            await self.db.delete(row)
        else:
            variant = require_found(
                await self.db.get(Variant, row.variant_id), "Variant"
            )
            product = require_found(
                await self.db.get(Product, variant.product_id), "Product"
            )
            if not (
                product.allow_backorder or product.preorder
            ) and quantity > await self.available(variant.id):
                raise ConflictError("Not enough stock for this quantity.")
            row.quantity = quantity
        # Cart edits invalidate its checkout holds, releasing stock immediately.
        from backend.models.commerce import Reservation

        reservations = (
            await self.db.scalars(
                select(Reservation).where(
                    Reservation.cart_id == cart.id, Reservation.status == "active"
                )
            )
        ).all()
        for hold in reservations:
            stock = require_found(
                await Stock.get(self.db, hold.stock_id, lock=True), "Stock"
            )
            stock.quantity_reserved -= hold.quantity
            hold.status = "cancelled"
            await InventoryService(self.db).synchronize_alert(stock)
        await self.db.commit()
        return await self.view(cart)

    async def merge(self, actor: UserResponse, guest: str | None) -> CartResponse:
        cart = await self.get(actor, guest)
        if guest:
            source = await self.db.scalar(
                select(Cart)
                .where(Cart.guest_hash == hash_token(guest))
                .with_for_update()
            )
            if source and source.id != cart.id:
                rows = (
                    await self.db.scalars(
                        select(CartItem).where(CartItem.cart_id == source.id)
                    )
                ).all()
                for item in rows:
                    existing = await self.db.scalar(
                        select(CartItem).where(
                            CartItem.cart_id == cart.id,
                            CartItem.variant_id == item.variant_id,
                        )
                    )
                    if existing:
                        if existing.quantity + item.quantity > 99:
                            raise ConflictError(
                                "Cart quantities exceed 99. Adjust the cart before merging."
                            )
                        existing.quantity += item.quantity
                        await self.db.delete(item)
                    else:
                        item.cart_id = cart.id
                await self.db.flush()
                await self.db.delete(source)
        await self.db.commit()
        return await self.view(cart)
