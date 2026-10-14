from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field

from backend.schemas.commerce import Schema


class BookFormat(StrEnum):
    HARDCOVER = "hardcover"
    PAPERBACK = "paperback"
    EBOOK = "ebook"
    AUDIOBOOK = "audiobook"


class WarehouseCreate(Schema):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    location: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=3000)
    active: bool = True


class Warehouse(WarehouseCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


class StockCreate(Schema):
    warehouse_id: UUID
    variant_id: UUID
    quantity_on_hand: int = Field(default=0, ge=0)
    reorder_point: int = Field(default=5, ge=0)


class Stock(Schema):
    id: UUID
    warehouse_id: UUID
    variant_id: UUID
    quantity_on_hand: int
    quantity_reserved: int
    reorder_point: int
    available_stock: int
    product_name: str
    variant_name: str
    sku: str
    warehouse_name: str
    title_id: UUID | None = None
    format: BookFormat | None = None


class StockAdjustment(Schema):
    delta: int = Field(ge=-1000000, le=1000000)
    reason: str = Field(min_length=3, max_length=500)


class ThresholdPatch(Schema):
    reorder_point: int = Field(ge=0)


class TransferInput(Schema):
    stock_id: UUID
    destination_warehouse_id: UUID
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=500)


class ReservationCreate(Schema):
    stock_id: UUID
    quantity: int = Field(gt=0, le=10000)
    cart_id: UUID | None = None


class Reservation(Schema):
    id: UUID
    stock_id: UUID
    variant_id: UUID
    user_id: UUID
    cart_id: UUID | None
    order_id: UUID | None
    quantity: int
    expires_at: datetime
    created_at: datetime
    status: str
    product_name: str = ""
    sku: str = ""


class Alert(Schema):
    id: UUID
    stock_id: UUID
    message: str
    status: str
    product_name: str
    sku: str
    warehouse_name: str
    available_stock: int
    reorder_point: int
    updated_at: datetime


class AlertPatch(Schema):
    status: Literal["open", "acknowledged", "resolved"]


class ReplenishmentCreate(Schema):
    stock_id: UUID
    quantity: int = Field(gt=0)
    kind: Literal["backorder", "preorder"] = "backorder"
    expected_at: datetime | None = None
    supplier: str = Field(default="", max_length=120)


class ReceiptInput(Schema):
    quantity: int = Field(gt=0)


class Replenishment(ReplenishmentCreate):
    id: UUID
    received_quantity: int
    status: str
    created_at: datetime
    sku: str = ""
    product_name: str = ""
    warehouse_name: str = ""


class Movement(Schema):
    id: UUID
    stock_id: UUID
    delta: int
    kind: str
    reason: str
    actor_id: UUID | None
    reference: str | None
    created_at: datetime


class ErrorResponse(Schema):
    detail: str
