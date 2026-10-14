from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import Permission
from backend.core.config import Settings, get_settings
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import Message, Record
from backend.schemas.inventory import (
    Alert,
    AlertPatch,
    Movement,
    ReceiptInput,
    Replenishment,
    ReplenishmentCreate,
    Reservation,
    ReservationCreate,
    Stock,
    StockAdjustment,
    StockCreate,
    ThresholdPatch,
    TransferInput,
    Warehouse,
    WarehouseCreate,
)
from backend.services.inventory import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])
DB = Annotated[AsyncSession, Depends(get_session)]
Config = Annotated[Settings, Depends(get_settings)]
Viewer = Annotated[UserResponse, Depends(Permission("inventory.view"))]
Manager = Annotated[UserResponse, Depends(Permission("inventory.manage"))]


@router.get("/variants", response_model=list[Record])
async def variants(actor: Viewer, db: DB) -> list[Record]:
    return await InventoryService(db).variants()


@router.get("/warehouses", response_model=list[Warehouse])
async def warehouses(actor: Viewer, db: DB) -> list[Warehouse]:
    return await InventoryService(db).warehouses()


@router.post("/warehouses", response_model=Warehouse, status_code=201)
async def create_warehouse(
    payload: WarehouseCreate, actor: Manager, db: DB
) -> Warehouse:
    return await InventoryService(db).save_warehouse(payload, actor)


@router.get("/warehouses/{identifier}", response_model=Warehouse)
async def warehouse_detail(identifier: UUID, actor: Viewer, db: DB) -> Warehouse:
    return await InventoryService(db).warehouse_detail(identifier)


@router.patch("/warehouses/{identifier}", response_model=Warehouse)
async def update_warehouse(
    identifier: UUID, payload: WarehouseCreate, actor: Manager, db: DB
) -> Warehouse:
    return await InventoryService(db).save_warehouse(payload, actor, identifier)


@router.delete("/warehouses/{identifier}", response_model=Message)
async def delete_warehouse(identifier: UUID, actor: Manager, db: DB) -> Message:
    await InventoryService(db).delete_warehouse(identifier, actor)
    return Message(detail="Warehouse removed.")


@router.get("/stock", response_model=list[Stock])
async def stock(actor: Viewer, db: DB, settings: Config) -> list[Stock]:
    return await InventoryService(db, settings.reservation_minutes).stocks()


@router.post("/stock", response_model=Stock, status_code=201)
async def create_stock(payload: StockCreate, actor: Manager, db: DB) -> Stock:
    return await InventoryService(db).create_stock(payload, actor)


@router.post("/stock/{identifier}/adjust", response_model=Stock)
async def adjust_stock(
    identifier: UUID, payload: StockAdjustment, actor: Manager, db: DB
) -> Stock:
    return await InventoryService(db).adjust(identifier, payload, actor)


@router.patch("/stock/{identifier}", response_model=Stock)
async def stock_threshold(
    identifier: UUID, payload: ThresholdPatch, actor: Manager, db: DB
) -> Stock:
    return await InventoryService(db).set_threshold(identifier, payload, actor)


@router.post("/transfers", response_model=Message)
async def transfer_stock(payload: TransferInput, actor: Manager, db: DB) -> Message:
    await InventoryService(db).transfer(
        payload.stock_id,
        payload.destination_warehouse_id,
        payload.quantity,
        payload.reason,
        actor,
    )
    return Message(detail="Stock transferred.")


@router.get("/movements", response_model=list[Movement])
async def stock_movements(actor: Viewer, db: DB) -> list[Movement]:
    return await InventoryService(db).movements()


@router.get("/reservations", response_model=list[Reservation])
async def reservations(actor: Viewer, db: DB, settings: Config) -> list[Reservation]:
    return await InventoryService(db, settings.reservation_minutes).reservations()


@router.post("/reservations", response_model=Reservation, status_code=201)
async def create_reservation(
    payload: ReservationCreate, actor: Manager, db: DB, settings: Config
) -> Reservation:
    service = InventoryService(db, settings.reservation_minutes)
    return await service.reservation_view(await service.reserve(payload, actor))


@router.post("/reservations/expire", response_model=Message)
async def expire_reservations(actor: Manager, db: DB, settings: Config) -> Message:
    count = await InventoryService(db, settings.reservation_minutes).expire()
    await db.commit()
    return Message(detail=f"Expired {count} reservations.")


@router.post("/reservations/{identifier}/cancel", response_model=Reservation)
async def cancel_reservation(identifier: UUID, actor: Manager, db: DB) -> Reservation:
    service = InventoryService(db)
    return await service.reservation_view(
        await service.cancel_reservation(identifier, actor)
    )


@router.get("/alerts", response_model=list[Alert])
async def alerts(actor: Viewer, db: DB) -> list[Alert]:
    return await InventoryService(db).alerts()


@router.patch("/alerts/{identifier}", response_model=Message)
async def update_alert(
    identifier: UUID, payload: AlertPatch, actor: Manager, db: DB
) -> Message:
    return await InventoryService(db).update_alert(identifier, payload, actor)


@router.get("/replenishments", response_model=list[Replenishment])
async def replenishments(actor: Viewer, db: DB) -> list[Replenishment]:
    return await InventoryService(db).replenishments()


@router.post("/replenishments", response_model=Replenishment, status_code=201)
async def create_replenishment(
    payload: ReplenishmentCreate, actor: Manager, db: DB
) -> Replenishment:
    return await InventoryService(db).create_replenishment(payload, actor)


@router.post("/replenishments/{identifier}/receive", response_model=Replenishment)
async def receive_replenishment(
    identifier: UUID, payload: ReceiptInput, actor: Manager, db: DB
) -> Replenishment:
    return await InventoryService(db).receive(identifier, payload.quantity, actor)


@router.post("/replenishments/{identifier}/cancel", response_model=Message)
async def cancel_replenishment(identifier: UUID, actor: Manager, db: DB) -> Message:
    return await InventoryService(db).cancel_replenishment(identifier, actor)
