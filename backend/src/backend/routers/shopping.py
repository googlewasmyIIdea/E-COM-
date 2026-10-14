from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import optional_user, require_user
from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    CartAdd,
    CartResponse,
    CheckoutInput,
    OrderResponse,
    QuantityInput,
    QuoteInput,
    QuoteResponse,
    Record,
    ReturnInput,
)
from backend.schemas.inventory import Reservation
from backend.services.cart import CartService
from backend.services.invoices import InvoiceService
from backend.services.orders import OrderService

router = APIRouter(tags=["shopping"])
DB = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[UserResponse, Depends(require_user)]
OptionalActor = Annotated[UserResponse | None, Depends(optional_user)]
Guest = Annotated[str | None, Header(alias="X-Guest-Cart")]
Config = Annotated[Settings, Depends(get_settings)]


@router.get("/cart", response_model=CartResponse)
async def cart(actor: OptionalActor, db: DB, guest: Guest = None) -> CartResponse:
    service = CartService(db)
    current = await service.get(actor, guest)
    await db.commit()
    return await service.view(current)


@router.post("/cart/items", response_model=CartResponse)
async def cart_add(
    payload: CartAdd, actor: OptionalActor, db: DB, guest: Guest = None
) -> CartResponse:
    service = CartService(db)
    return await service.add(await service.get(actor, guest), payload)


@router.patch("/cart/items/{identifier}", response_model=CartResponse)
async def cart_change(
    identifier: UUID,
    payload: QuantityInput,
    actor: OptionalActor,
    db: DB,
    guest: Guest = None,
) -> CartResponse:
    service = CartService(db)
    return await service.change(
        await service.get(actor, guest), identifier, payload.quantity
    )


@router.delete("/cart/items/{identifier}", response_model=CartResponse)
async def cart_remove(
    identifier: UUID, actor: OptionalActor, db: DB, guest: Guest = None
) -> CartResponse:
    service = CartService(db)
    return await service.change(await service.get(actor, guest), identifier, None)


@router.post("/cart/merge", response_model=CartResponse)
async def cart_merge(actor: Actor, db: DB, guest: Guest = None) -> CartResponse:
    return await CartService(db).merge(actor, guest)


@router.post("/checkout/reserve", response_model=list[Reservation])
async def checkout_reserve(actor: Actor, db: DB, settings: Config) -> list[Reservation]:
    rows = await OrderService(db, settings.reservation_minutes).hold_cart(actor)
    return [Reservation.model_validate(row) for row in rows]


@router.post("/checkout/orders", response_model=OrderResponse, status_code=201)
async def checkout(
    payload: CheckoutInput, actor: Actor, db: DB, settings: Config
) -> OrderResponse:
    from backend.core.exception import ServiceUnavailableError

    if payload.payment_method == "khalti" and not settings.khalti_secret_key:
        raise ServiceUnavailableError(
            "Khalti is not configured. Choose Cash on Delivery."
        )
    if payload.payment_method == "esewa" and not (
        settings.esewa_secret_key and settings.esewa_product_code
    ):
        raise ServiceUnavailableError(
            "eSewa is not configured. Choose Cash on Delivery."
        )
    return await OrderService(db, settings.reservation_minutes).create(payload, actor)


@router.get("/orders", response_model=list[OrderResponse])
async def orders(actor: Actor, db: DB) -> list[OrderResponse]:
    return await OrderService(db).orders(actor)


@router.get("/orders/{identifier}", response_model=OrderResponse)
async def order_detail(identifier: UUID, actor: Actor, db: DB) -> OrderResponse:
    service = OrderService(db)
    return await service.view(await service.owned(identifier, actor))


@router.post("/orders/{identifier}/cancel", response_model=OrderResponse)
async def order_cancel(identifier: UUID, actor: Actor, db: DB) -> OrderResponse:
    return await OrderService(db).cancel(identifier, actor)


@router.post("/orders/{identifier}/return", response_model=Record, status_code=201)
async def request_return(
    identifier: UUID, payload: ReturnInput, actor: Actor, db: DB
) -> Record:
    return await OrderService(db).request_return(identifier, payload, actor)


@router.get("/orders/{identifier}/invoice", response_class=HTMLResponse)
async def invoice(identifier: UUID, actor: Actor, db: DB) -> HTMLResponse:
    document = await InvoiceService(db).render(identifier, actor)
    return HTMLResponse(
        document.html,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/checkout/quote", response_model=QuoteResponse)
async def checkout_quote(payload: QuoteInput, actor: Actor, db: DB) -> QuoteResponse:
    cart_service = CartService(db)
    cart = await cart_service.get(actor, None)
    current = await cart_service.view(cart)
    quote = await OrderService(db).prices(
        current.subtotal, payload.delivery, payload.coupon_code
    )
    await db.commit()
    return quote
