from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import require_user
from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    PaymentInitiation,
    PaymentResult,
    PaymentVerification,
    Schema,
)
from backend.services.payments import PaymentService

router = APIRouter(tags=["payments"])
DB = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[UserResponse, Depends(require_user)]
Config = Annotated[Settings, Depends(get_settings)]


async def payment_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(timeout=20) as client:
        yield client


class PaymentOptions(Schema):
    cod: bool = True
    esewa: bool
    khalti: bool


@router.get("/store/payment-options", response_model=PaymentOptions)
async def payment_options(settings: Config) -> PaymentOptions:
    return PaymentOptions(
        esewa=bool(settings.esewa_secret_key and settings.esewa_product_code),
        khalti=bool(settings.khalti_secret_key),
    )


@router.post("/payments/{identifier}/initiate", response_model=PaymentInitiation)
async def initiate_payment(
    identifier: UUID,
    actor: Actor,
    db: DB,
    settings: Config,
    http: Annotated[httpx.AsyncClient, Depends(payment_client)],
) -> PaymentInitiation:
    return await PaymentService(db, settings, http).initiate(identifier, actor)


@router.post("/payments/{identifier}/verify", response_model=PaymentResult)
async def verify_payment(
    identifier: UUID,
    payload: PaymentVerification,
    actor: Actor,
    db: DB,
    settings: Config,
    http: Annotated[httpx.AsyncClient, Depends(payment_client)],
) -> PaymentResult:
    return await PaymentService(db, settings, http).verify(
        identifier, payload.reference, actor
    )
