from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import JsonValue, RootModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import Permission, require_user
from backend.core.config import Settings, get_settings
from backend.core.exception import ValidationError
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    Message,
    OrderResponse,
    Overview,
    ProductResponse,
    Record,
    RecordList,
    UploadResponse,
)
from backend.services.admin import AdminService
from backend.services.uploads import UploadService

router = APIRouter(prefix="/admin", tags=["administration"])
DB = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[UserResponse, Depends(require_user)]
DashboardActor = Annotated[UserResponse, Depends(Permission("dashboard.view"))]


class Input(RootModel[dict[str, JsonValue]]):
    pass


@router.get("/overview", response_model=Overview)
async def overview(actor: DashboardActor, db: DB) -> Overview:
    return await AdminService(db).overview()


@router.get("/analytics", response_model=Overview)
async def analytics(actor: DashboardActor, db: DB) -> Overview:
    return await AdminService(db).overview()


@router.post("/uploads", response_model=UploadResponse, status_code=201)
async def upload_image(
    actor: Annotated[UserResponse, Depends(Permission("catalog.manage"))],
    settings: Annotated[Settings, Depends(get_settings)],
    file: Annotated[UploadFile, File()],
) -> UploadResponse:
    content = await file.read(8 * 1024 * 1024 + 1)
    if len(content) > 8 * 1024 * 1024:
        raise ValidationError("Images must be below 8 MiB.")
    return await UploadService(settings).save(content)


@router.get("/{resource}", response_model=RecordList)
async def records(
    resource: str,
    actor: Actor,
    db: DB,
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
) -> RecordList:
    return await AdminService(db).list(resource, actor, q, page, page_size)


@router.post("/{resource}", response_model=Record | ProductResponse, status_code=201)
async def create_record(
    resource: str, payload: Input, actor: Actor, db: DB
) -> Record | ProductResponse:
    return await AdminService(db).create(resource, payload.root, actor)


@router.get(
    "/{resource}/{identifier}", response_model=Record | ProductResponse | OrderResponse
)
async def get_record(
    resource: str, identifier: UUID, actor: Actor, db: DB
) -> Record | ProductResponse | OrderResponse:
    return await AdminService(db).get_record(resource, identifier, actor)


@router.patch(
    "/{resource}/{identifier}", response_model=Record | ProductResponse | OrderResponse
)
async def update_record(
    resource: str, identifier: UUID, payload: Input, actor: Actor, db: DB
) -> Record | ProductResponse | OrderResponse:
    return await AdminService(db).update(resource, identifier, payload.root, actor)


@router.delete("/{resource}/{identifier}", response_model=Message)
async def delete_record(
    resource: str, identifier: UUID, actor: Actor, db: DB
) -> Message:
    await AdminService(db).remove(resource, identifier, actor)
    return Message(detail="Record deactivated or removed.")
