"""Persistent stationery commerce models; authentication tables remain separate."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Self
from uuid import UUID, uuid4

from pydantic import JsonValue
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Entity(Base):
    __abstract__ = True
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    @classmethod
    async def get(
        cls, db: AsyncSession, identifier: UUID, lock: bool = False
    ) -> Self | None:
        statement = select(cls).where(cls.id == identifier)
        if lock:
            statement = statement.with_for_update()
        result = await db.execute(statement)
        return result.scalars().one_or_none()


class Category(Entity, Base):
    __tablename__ = "categories"
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str] = mapped_column(
        String(1000), default="/images/stationery-fallback.webp"
    )
    parent_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("categories.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Collection(Entity, Base):
    __tablename__ = "collections"
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str] = mapped_column(
        String(1000), default="/images/stationery-fallback.webp"
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Product(Entity, Base):
    __tablename__ = "products"
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("categories.id"), index=True
    )
    brand: Mapped[str] = mapped_column(String(120), default="Paper & Petal")
    images: Mapped[list[str]] = mapped_column(JSON, default=list)
    attributes: Mapped[dict[str, JsonValue]] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_backorder: Mapped[bool] = mapped_column(Boolean, default=False)
    preorder: Mapped[bool] = mapped_column(Boolean, default=False)
    release_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProductCollection(Base):
    __tablename__ = "product_collections"
    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    collection_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )


class Variant(Entity, Base):
    __tablename__ = "variants"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_variant_price"),)
    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id"), index=True
    )
    sku: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    compare_at_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    attributes: Mapped[dict[str, JsonValue]] = mapped_column(JSON, default=dict)
    image: Mapped[str | None] = mapped_column(String(1000))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Warehouse(Entity, Base):
    __tablename__ = "warehouses"
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(32), unique=True)
    location: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Stock(Entity, Base):
    __tablename__ = "stock"
    __table_args__ = (
        UniqueConstraint(
            "warehouse_id", "variant_id", name="uq_stock_warehouse_variant"
        ),
        CheckConstraint(
            "quantity_on_hand >= 0 AND quantity_reserved >= 0 AND quantity_reserved <= quantity_on_hand",
            name="ck_stock_quantities",
        ),
        CheckConstraint("reorder_point >= 0", name="ck_stock_reorder"),
    )
    warehouse_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("warehouses.id"), index=True
    )
    variant_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("variants.id"), index=True
    )
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=5)


class StockMovement(Entity, Base):
    __tablename__ = "stock_movements"
    stock_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("stock.id"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(500))
    actor_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    reference: Mapped[str | None] = mapped_column(String(100))


class Cart(Entity, Base):
    __tablename__ = "carts"
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True
    )
    guest_hash: Mapped[str | None] = mapped_column(String(64), unique=True)


class CartItem(Entity, Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("cart_id", "variant_id", name="uq_cart_variant"),
        CheckConstraint("quantity > 0", name="ck_cart_quantity"),
    )
    cart_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("carts.id", ondelete="CASCADE"), index=True
    )
    variant_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("variants.id"))
    quantity: Mapped[int] = mapped_column(Integer)


class Order(Entity, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_order_idempotency"),
    )
    number: Mapped[str] = mapped_column(String(40), unique=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="processing", index=True)
    payment_status: Mapped[str] = mapped_column(String(32), default="unpaid")
    payment_method: Mapped[str] = mapped_column(String(32))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    shipping: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="NPR")
    address: Mapped[dict[str, JsonValue]] = mapped_column(JSON)
    delivery: Mapped[str] = mapped_column(String(32))
    coupon_code: Mapped[str | None] = mapped_column(String(64))
    tracking_number: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str] = mapped_column(Text, default="")
    stock_released: Mapped[bool] = mapped_column(Boolean, default=False)


class OrderItem(Entity, Base):
    __tablename__ = "order_items"
    order_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("orders.id"), index=True)
    variant_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("variants.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    variant_name: Mapped[str] = mapped_column(String(120))
    sku: Mapped[str] = mapped_column(String(100))
    image: Mapped[str] = mapped_column(String(1000))
    quantity: Mapped[int] = mapped_column(Integer)
    allocated: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Reservation(Entity, Base):
    __tablename__ = "reservations"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_reservation_quantity"),)
    stock_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("stock.id"), index=True)
    variant_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("variants.id"))
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    cart_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("carts.id"))
    order_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("orders.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)


class Allocation(Entity, Base):
    __tablename__ = "allocations"
    order_item_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("order_items.id"), index=True
    )
    stock_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("stock.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    released: Mapped[bool] = mapped_column(Boolean, default=False)


class Alert(Entity, Base):
    __tablename__ = "alerts"
    stock_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("stock.id"), unique=True)
    message: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="open")


class Replenishment(Entity, Base):
    __tablename__ = "replenishments"
    stock_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("stock.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[str] = mapped_column(String(32), default="backorder")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supplier: Mapped[str] = mapped_column(String(120), default="")


class Coupon(Entity, Base):
    __tablename__ = "coupons"
    code: Mapped[str] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(32))
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    min_spend: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    max_uses: Mapped[int | None] = mapped_column(Integer)
    uses: Mapped[int] = mapped_column(Integer, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Promotion(Entity, Base):
    __tablename__ = "promotions"
    name: Mapped[str] = mapped_column(String(160))
    headline: Mapped[str] = mapped_column(String(240))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(500), default="/shop")
    image: Mapped[str] = mapped_column(String(1000), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Review(Entity, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("product_id", "user_id", name="uq_review_user_product"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating"),
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False)
    reports: Mapped[int] = mapped_column(Integer, default=0)


class Wishlist(Entity, Base):
    __tablename__ = "wishlist"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),
    )
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    product_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("products.id"))


class Address(Entity, Base):
    __tablename__ = "addresses"
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    line1: Mapped[str] = mapped_column(String(240))
    line2: Mapped[str] = mapped_column(String(240), default="")
    city: Mapped[str] = mapped_column(String(120))
    postal_code: Mapped[str] = mapped_column(String(20), default="")
    country: Mapped[str] = mapped_column(String(2), default="NP")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class Payment(Entity, Base):
    __tablename__ = "payments"
    order_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("orders.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(32))
    reference: Mapped[str | None] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response: Mapped[dict[str, JsonValue]] = mapped_column(JSON, default=dict)


class ReturnRequest(Entity, Base):
    __tablename__ = "returns"
    order_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("orders.id"), unique=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="requested")
    notes: Mapped[str] = mapped_column(Text, default="")


class Newsletter(Entity, Base):
    __tablename__ = "newsletter"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    consent: Mapped[bool] = mapped_column(Boolean)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Setting(Entity, Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(100), unique=True)
    value: Mapped[JsonValue] = mapped_column(JSON)
    public: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditLog(Entity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    resource: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str] = mapped_column(String(100))
    detail: Mapped[dict[str, JsonValue]] = mapped_column(JSON, default=dict)


class Notification(Entity, Base):
    __tablename__ = "notifications"
    user_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    recipient: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str] = mapped_column(String(240))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(500))


class AccountToken(Entity, Base):
    __tablename__ = "account_tokens"
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class LoginThrottle(Base):
    __tablename__ = "login_throttles"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class ReviewReport(Entity, Base):
    __tablename__ = "review_reports"
    __table_args__ = (
        UniqueConstraint("review_id", "user_id", name="uq_review_report_user"),
    )
    review_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("reviews.id", ondelete="CASCADE")
    )
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))


class Shipment(Entity, Base):
    __tablename__ = "shipments"
    order_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("orders.id"), unique=True)
    tracking_number: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default="shipped")
    shipped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
