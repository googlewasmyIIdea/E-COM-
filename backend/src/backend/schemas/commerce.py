from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    JsonValue,
    SecretStr,
    field_validator,
    model_validator,
)

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
Role = Literal["customer", "staff", "admin"]


class Schema(BaseModel):
    model_config = ConfigDict(
        extra="forbid", from_attributes=True, hide_input_in_errors=True
    )


class Message(Schema):
    detail: str


class RegisterRequest(Schema):
    email: EmailStr
    password: SecretStr = Field(min_length=10, max_length=1024)
    name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if not any(c.isalpha() for c in password) or not any(
            c.isdigit() for c in password
        ):
            raise ValueError("Include both letters and numbers.")
        return value


class PasswordRequest(Schema):
    email: EmailStr


class ResetRequest(Schema):
    token: str = Field(min_length=20, max_length=200)
    password: SecretStr = Field(min_length=10, max_length=1024)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: SecretStr) -> SecretStr:
        return RegisterRequest.strong_password(value)


class ChangePassword(Schema):
    current_password: SecretStr
    password: SecretStr = Field(min_length=10, max_length=1024)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: SecretStr) -> SecretStr:
        return RegisterRequest.strong_password(value)


class TokenRequest(Schema):
    token: str = Field(min_length=20, max_length=200)


class ProfilePatch(Schema):
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    preferences: dict[str, JsonValue] | None = None


class CustomerPatch(Schema):
    name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=32)
    role: Role = "customer"
    permissions: list[str] = Field(default_factory=list)
    is_active: bool = Field(default=True, strict=True)


class AddressInput(Schema):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=7, max_length=32)
    line1: str = Field(min_length=3, max_length=240)
    line2: str = Field(default="", max_length=240)
    city: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(default="", max_length=20)
    country: str = Field(default="NP", min_length=2, max_length=2)
    is_default: bool = False


class TaxonomyInput(Schema):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=140)
    description: str = Field(default="", max_length=5000)
    image: str = "/images/stationery-fallback.webp"
    parent_id: UUID | None = None
    active: bool = True


class VariantInput(Schema):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    price: Money
    compare_at_price: Money | None = None
    attributes: dict[str, JsonValue] = Field(default_factory=dict)
    image: str | None = None
    active: bool = True

    @model_validator(mode="after")
    def valid_price(self) -> Self:
        if self.compare_at_price is not None and self.compare_at_price < self.price:
            raise ValueError("Original price must be at least the selling price.")
        return self


class ProductInput(Schema):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=220)
    description: str = Field(default="", max_length=20000)
    category_id: UUID | None = None
    brand: str = Field(default="Paper & Petal", max_length=120)
    images: list[str] = Field(default_factory=list, max_length=12)
    attributes: dict[str, JsonValue] = Field(default_factory=dict)
    active: bool = True
    featured: bool = False
    allow_backorder: bool = False
    preorder: bool = False
    release_date: datetime | None = None
    collection_ids: list[UUID] = Field(default_factory=list)
    variants: list[VariantInput] = Field(min_length=1, max_length=50)

    @field_validator("images")
    @classmethod
    def safe_images(cls, values: list[str]) -> list[str]:
        if any(
            not (
                v.startswith("/images/")
                or v.startswith("/media/")
                or v.startswith("https://")
            )
            for v in values
        ):
            raise ValueError("Use local image paths or HTTPS URLs.")
        return values

    @model_validator(mode="after")
    def unique_variants(self) -> Self:
        skus = [variant.sku for variant in self.variants]
        if len(set(skus)) != len(skus):
            raise ValueError("Every variant must have a unique SKU.")
        if len(set(self.collection_ids)) != len(self.collection_ids):
            raise ValueError("Collections must be unique.")
        return self


class Record(Schema):
    id: UUID
    data: dict[str, JsonValue]


class RecordList(Schema):
    items: list[Record]
    total: int


class VariantResponse(Schema):
    id: UUID
    product_id: UUID
    sku: str
    name: str
    price: Decimal
    compare_at_price: Decimal | None
    attributes: dict[str, JsonValue]
    image: str | None
    active: bool
    available_stock: int = 0


class ReviewResponse(Schema):
    id: UUID
    product_id: UUID
    rating: int
    title: str
    body: str
    status: str
    verified_purchase: bool
    created_at: datetime
    author: str = "Customer"


class ProductResponse(Schema):
    id: UUID
    name: str
    slug: str
    description: str
    category_id: UUID | None
    category_name: str = "Stationery"
    brand: str
    images: list[str]
    attributes: dict[str, JsonValue]
    active: bool
    featured: bool
    allow_backorder: bool
    preorder: bool
    release_date: datetime | None
    created_at: datetime
    variants: list[VariantResponse]
    available_stock: int
    rating: Decimal | None = None
    review_count: int = 0
    reviews: list[ReviewResponse] = Field(default_factory=list)
    collection_ids: list[UUID] = Field(default_factory=list)


class ProductPage(Schema):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int


class TaxonomyResponse(Schema):
    id: UUID
    name: str
    slug: str
    description: str
    image: str
    active: bool
    parent_id: UUID | None = None


class ReviewInput(Schema):
    rating: int = Field(ge=1, le=5)
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=5, max_length=5000)


class NewsletterInput(Schema):
    email: EmailStr
    consent: Literal[True]


class CartAdd(Schema):
    variant_id: UUID
    quantity: int = Field(ge=1, le=99)


class QuantityInput(Schema):
    quantity: int = Field(ge=1, le=99)


class CartItemResponse(Schema):
    id: UUID
    variant_id: UUID
    product_id: UUID
    name: str
    slug: str
    variant_name: str
    sku: str
    image: str
    quantity: int
    price: Decimal
    total: Decimal
    available_stock: int
    allow_backorder: bool


class CartResponse(Schema):
    id: UUID
    items: list[CartItemResponse]
    subtotal: Decimal
    count: int
    currency: str = "NPR"


class CheckoutInput(Schema):
    address: AddressInput
    delivery: Literal["standard", "express"] = "standard"
    payment_method: Literal["cod", "esewa", "khalti"] = "cod"
    coupon_code: str | None = Field(default=None, max_length=64)
    idempotency_key: str = Field(min_length=12, max_length=100)


class OrderItemResponse(Schema):
    id: UUID
    variant_id: UUID
    product_name: str
    variant_name: str
    sku: str
    image: str
    quantity: int
    allocated: int
    unit_price: Decimal
    total: Decimal


class OrderResponse(Schema):
    id: UUID
    number: str
    user_id: UUID
    status: str
    payment_status: str
    payment_method: str
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    total: Decimal
    currency: str
    address: dict[str, JsonValue]
    delivery: str
    coupon_code: str | None
    tracking_number: str | None
    notes: str
    created_at: datetime
    items: list[OrderItemResponse]


class CouponInput(Schema):
    code: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    kind: Literal["percentage", "fixed", "free_shipping"]
    value: Money = Decimal("0")
    min_spend: Money = Decimal("0")
    max_uses: int | None = Field(default=None, ge=1)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    active: bool = True

    @field_validator("value")
    @classmethod
    def discount_value(cls, value: Decimal) -> Decimal:
        return value


class PromotionInput(Schema):
    name: str = Field(min_length=1, max_length=160)
    headline: str = Field(min_length=1, max_length=240)
    body: str = ""
    link: str = "/shop"
    image: str = ""
    active: bool = True
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @field_validator("link")
    @classmethod
    def valid_destination(cls, value: str) -> str:
        if not value.startswith("/") or value.startswith("//"):
            raise ValueError("Promotions must link to a page in this store.")
        return value


class SettingInput(Schema):
    key: str = Field(min_length=1, max_length=100)
    value: JsonValue
    public: bool = False

    @model_validator(mode="after")
    def validate_financial_setting(self) -> Self:
        if self.key in ("shipping_standard", "free_shipping_threshold"):
            try:
                amount = Decimal(str(self.value))
                if not amount.is_finite() or not Decimal("0") <= amount <= Decimal(
                    "10000000"
                ):
                    raise ValueError(
                        "Enter a nonnegative delivery setting below NPR 10,000,000."
                    )
            except Exception as exc:
                raise ValueError(
                    "Invalid delivery fee or free-shipping threshold."
                ) from exc
        if self.key == "contact_email" and (
            not isinstance(self.value, str) or "@" not in self.value
        ):
            raise ValueError("Enter a contact email address.")
        return self


class AdminPatch(Schema):
    data: dict[str, JsonValue]


class ReturnInput(Schema):
    reason: str = Field(min_length=5, max_length=3000)


class Overview(Schema):
    products: int
    customers: int
    orders: int
    revenue: Decimal
    low_stock: int
    active_reservations: int
    pending_orders: int
    recent_orders: list[OrderResponse]
    revenue_by_day: list[dict[str, JsonValue]]


class UploadResponse(Schema):
    url: str


class PaymentInitiation(Schema):
    provider: str
    payment_url: str | None = None
    form_url: str | None = None
    fields: dict[str, str] = Field(default_factory=dict)
    reference: str


class PaymentVerification(Schema):
    reference: str = Field(min_length=1, max_length=200)


class PaymentResult(Schema):
    order_id: UUID
    status: str
    verified: bool


class QuoteInput(Schema):
    delivery: Literal["standard", "express"] = "standard"
    coupon_code: str | None = Field(default=None, max_length=64)


class QuoteResponse(Schema):
    subtotal: Decimal
    shipping: Decimal
    discount: Decimal
    total: Decimal
    coupon_code: str | None
