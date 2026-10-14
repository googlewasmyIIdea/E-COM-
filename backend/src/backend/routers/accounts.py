from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import require_user
from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.schemas.auth import LoginResponse, UserResponse
from backend.schemas.commerce import (
    AddressInput,
    ChangePassword,
    Message,
    PasswordRequest,
    ProfilePatch,
    Record,
    RegisterRequest,
    ResetRequest,
    TokenRequest,
)
from backend.services.accounts import AccountService
from backend.services.common import record
from backend.services.customers import CustomerService

router = APIRouter(tags=["accounts"])
DB = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[UserResponse, Depends(require_user)]
Config = Annotated[Settings, Depends(get_settings)]


@router.post("/auth/register", response_model=LoginResponse, status_code=201)
async def register(payload: RegisterRequest, db: DB, settings: Config) -> LoginResponse:
    return await AccountService(db, settings).register(payload)


@router.post("/auth/password/forgot", response_model=Message)
async def forgot_password(
    payload: PasswordRequest, db: DB, settings: Config
) -> Message:
    await AccountService(db, settings).send_token(str(payload.email), "reset")
    return Message(
        detail="If that account exists, a password reset link has been sent."
    )


@router.post("/auth/password/reset", response_model=Message)
async def reset_password(payload: ResetRequest, db: DB, settings: Config) -> Message:
    await AccountService(db, settings).reset(payload)
    return Message(detail="Password updated. Please sign in again.")


@router.post("/auth/password/change", response_model=Message)
async def change_password(
    payload: ChangePassword, actor: Actor, db: DB, settings: Config
) -> Message:
    await AccountService(db, settings).change_password(actor, payload)
    return Message(detail="Password updated. Please sign in again.")


@router.post("/auth/verification/request", response_model=Message)
async def request_verification(actor: Actor, db: DB, settings: Config) -> Message:
    await AccountService(db, settings).send_token(actor.email, "verification")
    return Message(detail="Verification email requested.")


@router.post("/auth/verification/confirm", response_model=Message)
async def confirm_verification(
    payload: TokenRequest, db: DB, settings: Config
) -> Message:
    await AccountService(db, settings).verify_email(payload.token)
    return Message(detail="Email verified.")


@router.get("/account/profile", response_model=UserResponse)
async def profile(actor: Actor) -> UserResponse:
    return actor


@router.patch("/account/profile", response_model=UserResponse)
async def update_profile(
    payload: ProfilePatch, actor: Actor, db: DB, settings: Config
) -> UserResponse:
    return await AccountService(db, settings).profile(actor, payload)


@router.get("/account/addresses", response_model=list[Record])
async def addresses(actor: Actor, db: DB) -> list[Record]:
    return await CustomerService(db).addresses(actor)


@router.post("/account/addresses", response_model=Record, status_code=201)
async def add_address(
    payload: AddressInput, actor: Actor, db: DB, settings: Config
) -> Record:
    return record(await AccountService(db, settings).save_address(actor, payload))


@router.patch("/account/addresses/{identifier}", response_model=Record)
async def update_address(
    identifier: UUID, payload: AddressInput, actor: Actor, db: DB, settings: Config
) -> Record:
    return record(
        await AccountService(db, settings).save_address(actor, payload, identifier)
    )


@router.delete("/account/addresses/{identifier}", response_model=Message)
async def delete_address(identifier: UUID, actor: Actor, db: DB) -> Message:
    return await CustomerService(db).delete_address(identifier, actor)


@router.get("/account/wishlist", response_model=list[Record])
async def wishlist(actor: Actor, db: DB) -> list[Record]:
    return await CustomerService(db).wishlist(actor)


@router.post("/account/wishlist/{product_id}", response_model=Message)
async def add_wishlist(product_id: UUID, actor: Actor, db: DB) -> Message:
    return await CustomerService(db).add_wishlist(product_id, actor)


@router.delete("/account/wishlist/{product_id}", response_model=Message)
async def remove_wishlist(product_id: UUID, actor: Actor, db: DB) -> Message:
    return await CustomerService(db).remove_wishlist(product_id, actor)
