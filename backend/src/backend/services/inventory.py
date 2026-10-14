from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exception import ConflictError, ValidationError
from backend.models.commerce import (
    Alert,
    Cart,
    Product,
    Replenishment,
    Reservation,
    Stock,
    StockMovement,
    Variant,
    Warehouse,
)
from backend.models.commerce import Alert as AlertModel
from backend.models.commerce import Replenishment as ReplenishmentModel
from backend.models.commerce import Stock as StockModel
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import Message, Record
from backend.schemas.inventory import Alert as AlertView
from backend.schemas.inventory import (
    AlertPatch,
    Movement,
    ReplenishmentCreate,
    ReservationCreate,
    StockAdjustment,
    StockCreate,
    ThresholdPatch,
    WarehouseCreate,
)
from backend.schemas.inventory import Replenishment as ReplenishmentView
from backend.schemas.inventory import Reservation as ReservationView
from backend.schemas.inventory import Stock as StockView
from backend.schemas.inventory import Warehouse as WarehouseView
from backend.services.common import audit, require_found


class InventoryService:
    def __init__(self, db: AsyncSession, reservation_minutes: int = 15) -> None:
        self.db = db
        self.reservation_minutes = reservation_minutes

    async def variants(self) -> list[Record]:
        rows = (
            await self.db.execute(
                select(Variant, Product.name)
                .join(Product)
                .order_by(Product.name, Variant.sku)
            )
        ).all()
        return [
            Record(
                id=variant.id,
                data={
                    "sku": variant.sku,
                    "name": name + " / " + variant.name,
                    "active": variant.active,
                },
            )
            for variant, name in rows
        ]

    async def lock(self) -> None:
        # Serialize cross-SKU operations in a single transaction, then lock affected rows.
        # This consistent lock order prevents checkout/transfer/expiry deadlocks.
        if self.db.get_bind().dialect.name == "postgresql":
            await self.db.execute(text("SELECT pg_advisory_xact_lock(782612341)"))

    async def synchronize_alert(self, stock: Stock) -> None:
        alert = await self.db.scalar(select(Alert).where(Alert.stock_id == stock.id))
        low = stock.quantity_on_hand - stock.quantity_reserved <= stock.reorder_point
        if low:
            variant = require_found(
                await self.db.get(Variant, stock.variant_id), "Variant"
            )
            message = f"{variant.sku} has {stock.quantity_on_hand - stock.quantity_reserved} available; reorder threshold is {stock.reorder_point}."
            if alert:
                if alert.status == "resolved":
                    alert.status = "open"
                alert.message = message
            else:
                self.db.add(Alert(stock_id=stock.id, message=message, status="open"))
        elif alert:
            alert.status = "resolved"
        await self.db.flush()

    async def expire(self) -> int:
        await self.lock()
        now = datetime.now(UTC)
        expired = (
            await self.db.scalars(
                select(Reservation)
                .where(Reservation.status == "active", Reservation.expires_at <= now)
                .order_by(Reservation.stock_id, Reservation.id)
                .with_for_update()
            )
        ).all()
        for reservation in expired:
            stock = require_found(
                await Stock.get(self.db, reservation.stock_id, lock=True), "Stock"
            )
            stock.quantity_reserved -= reservation.quantity
            reservation.status = "expired"
            await self.db.flush()
            await self.synchronize_alert(stock)
        return len(expired)

    async def stock_view(self, stock: Stock) -> StockView:
        variant = require_found(await self.db.get(Variant, stock.variant_id), "Variant")
        product = require_found(
            await self.db.get(Product, variant.product_id), "Product"
        )
        warehouse = require_found(
            await self.db.get(Warehouse, stock.warehouse_id), "Warehouse"
        )
        return StockView(
            id=stock.id,
            warehouse_id=stock.warehouse_id,
            variant_id=stock.variant_id,
            quantity_on_hand=stock.quantity_on_hand,
            quantity_reserved=stock.quantity_reserved,
            reorder_point=stock.reorder_point,
            available_stock=stock.quantity_on_hand - stock.quantity_reserved,
            product_name=product.name,
            variant_name=variant.name,
            sku=variant.sku,
            warehouse_name=warehouse.name,
        )

    async def stocks(self) -> list[StockView]:
        await self.expire()
        rows = (await self.db.scalars(select(Stock).order_by(Stock.created_at))).all()
        for stock in rows:
            await self.synchronize_alert(stock)
        await self.db.commit()
        return [await self.stock_view(row) for row in rows]

    async def create_stock(
        self, payload: StockCreate, actor: UserResponse
    ) -> StockView:
        await self.lock()
        warehouse = require_found(
            await self.db.get(Warehouse, payload.warehouse_id), "Warehouse"
        )
        if not warehouse.active:
            raise ConflictError("Cannot add stock to an inactive warehouse.")
        require_found(await self.db.get(Variant, payload.variant_id), "Variant")
        if await self.db.scalar(
            select(Stock.id).where(
                Stock.warehouse_id == payload.warehouse_id,
                Stock.variant_id == payload.variant_id,
            )
        ):
            raise ConflictError("Stock already exists for this SKU and warehouse.")
        stock = Stock(**payload.model_dump())
        self.db.add(stock)
        await self.db.flush()
        self.db.add(
            StockMovement(
                stock_id=stock.id,
                delta=stock.quantity_on_hand,
                kind="initial",
                reason="Initial stock",
                actor_id=actor.id,
            )
        )
        await self.synchronize_alert(stock)
        await audit(self.db, actor, "create", "stock", stock.id)
        from backend.services.orders import OrderService

        await OrderService(self.db).allocate_backorders()
        await self.db.commit()
        return await self.stock_view(stock)

    async def adjust(
        self,
        identifier: UUID,
        payload: StockAdjustment,
        actor: UserResponse,
        commit: bool = True,
        kind: str = "adjustment",
    ) -> StockView:
        await self.expire()
        stock = require_found(await Stock.get(self.db, identifier, lock=True), "Stock")
        if stock.quantity_on_hand + payload.delta < stock.quantity_reserved:
            raise ConflictError("This adjustment would make available stock negative.")
        stock.quantity_on_hand += payload.delta
        self.db.add(
            StockMovement(
                stock_id=stock.id,
                delta=payload.delta,
                kind=kind,
                reason=payload.reason,
                actor_id=actor.id,
            )
        )
        await self.synchronize_alert(stock)
        await audit(
            self.db,
            actor,
            kind,
            "stock",
            stock.id,
            {"delta": payload.delta, "reason": payload.reason},
        )
        if commit:
            if payload.delta > 0:
                from backend.services.orders import OrderService

                await OrderService(self.db).allocate_backorders()
            await self.db.commit()
        return await self.stock_view(stock)

    async def warehouses(self) -> list[WarehouseView]:
        rows = (await self.db.scalars(select(Warehouse).order_by(Warehouse.name))).all()
        return [WarehouseView.model_validate(row) for row in rows]

    async def save_warehouse(
        self,
        payload: WarehouseCreate,
        actor: UserResponse,
        identifier: UUID | None = None,
    ) -> WarehouseView:
        await self.lock()
        existing = await self.db.scalar(
            select(Warehouse).where(Warehouse.code == payload.code)
        )
        if existing and existing.id != identifier:
            raise ConflictError("Warehouse code is already in use.")
        if identifier:
            row = require_found(
                await Warehouse.get(self.db, identifier, lock=True), "Warehouse"
            )
            if not payload.active and await self.db.scalar(
                select(Stock.id)
                .where(Stock.warehouse_id == identifier, Stock.quantity_reserved > 0)
                .limit(1)
            ):
                raise ConflictError(
                    "Release active reservations before deactivating this warehouse."
                )
            for key, value in payload.model_dump().items():
                setattr(row, key, value)
        else:
            row = Warehouse(**payload.model_dump())
            self.db.add(row)
            await self.db.flush()
        await audit(
            self.db, actor, "update" if identifier else "create", "warehouses", row.id
        )
        await self.db.commit()
        return WarehouseView.model_validate(row)

    async def delete_warehouse(self, identifier: UUID, actor: UserResponse) -> None:
        await self.lock()
        row = require_found(
            await Warehouse.get(self.db, identifier, lock=True), "Warehouse"
        )
        if await self.db.scalar(
            select(Stock.id).where(Stock.warehouse_id == identifier).limit(1)
        ):
            raise ConflictError(
                "This warehouse has stock history. Deactivate it instead."
            )
        await self.db.delete(row)
        await audit(self.db, actor, "delete", "warehouses", identifier)
        await self.db.commit()

    async def reservation_view(self, row: Reservation) -> ReservationView:
        variant = await self.db.get(Variant, row.variant_id)
        product = await self.db.get(Product, variant.product_id) if variant else None
        return ReservationView.model_validate(row).model_copy(
            update={
                "sku": variant.sku if variant else "",
                "product_name": product.name if product else "",
            }
        )

    async def reserve(
        self, payload: ReservationCreate, actor: UserResponse, commit: bool = True
    ) -> Reservation:
        await self.expire()
        stock = require_found(
            await Stock.get(self.db, payload.stock_id, lock=True), "Stock"
        )
        warehouse = require_found(
            await self.db.get(Warehouse, stock.warehouse_id), "Warehouse"
        )
        if not warehouse.active:
            raise ConflictError("Warehouse is inactive.")
        if payload.cart_id:
            cart = require_found(await self.db.get(Cart, payload.cart_id), "Cart")
            if cart.user_id != actor.id:
                raise ValidationError("Reservation cart is not owned by this account.")
        if stock.quantity_on_hand - stock.quantity_reserved < payload.quantity:
            raise ConflictError("Not enough available stock.")
        stock.quantity_reserved += payload.quantity
        reservation = Reservation(
            stock_id=stock.id,
            variant_id=stock.variant_id,
            user_id=actor.id,
            cart_id=payload.cart_id,
            quantity=payload.quantity,
            expires_at=datetime.now(UTC) + timedelta(minutes=self.reservation_minutes),
        )
        self.db.add(reservation)
        await self.db.flush()
        await self.synchronize_alert(stock)
        if commit:
            await self.db.commit()
        return reservation

    async def cancel_reservation(
        self, identifier: UUID, actor: UserResponse, commit: bool = True
    ) -> Reservation:
        await self.lock()
        reservation = require_found(
            await Reservation.get(self.db, identifier, lock=True), "Reservation"
        )
        if actor.role not in ("staff", "admin") and reservation.user_id != actor.id:
            raise ValidationError("Reservation belongs to another account.")
        if reservation.status == "active":
            stock = require_found(
                await Stock.get(self.db, reservation.stock_id, lock=True), "Stock"
            )
            stock.quantity_reserved -= reservation.quantity
            reservation.status = "cancelled"
            await self.synchronize_alert(stock)
        if commit:
            await self.db.commit()
        return reservation

    async def reservations(self) -> list[ReservationView]:
        await self.expire()
        await self.db.commit()
        rows = (
            await self.db.scalars(
                select(Reservation).order_by(Reservation.created_at.desc())
            )
        ).all()
        return [await self.reservation_view(row) for row in rows]

    async def alerts(self) -> list[AlertView]:
        await self.stocks()
        rows = (
            await self.db.scalars(select(Alert).order_by(Alert.updated_at.desc()))
        ).all()
        views: list[AlertView] = []
        for row in rows:
            stock = require_found(await self.db.get(Stock, row.stock_id), "Stock")
            detail = await self.stock_view(stock)
            views.append(
                AlertView(
                    id=row.id,
                    stock_id=row.stock_id,
                    message=row.message,
                    status=row.status,
                    product_name=detail.product_name,
                    sku=detail.sku,
                    warehouse_name=detail.warehouse_name,
                    available_stock=detail.available_stock,
                    reorder_point=detail.reorder_point,
                    updated_at=row.updated_at,
                )
            )
        return views

    async def replenishment_view(self, row: Replenishment) -> ReplenishmentView:
        stock = require_found(await self.db.get(Stock, row.stock_id), "Stock")
        detail = await self.stock_view(stock)
        return ReplenishmentView.model_validate(row).model_copy(
            update={
                "sku": detail.sku,
                "product_name": detail.product_name,
                "warehouse_name": detail.warehouse_name,
            }
        )

    async def create_replenishment(
        self, payload: ReplenishmentCreate, actor: UserResponse
    ) -> ReplenishmentView:
        require_found(await self.db.get(Stock, payload.stock_id), "Stock")
        row = Replenishment(**payload.model_dump())
        self.db.add(row)
        await self.db.flush()
        await audit(self.db, actor, "create", "replenishments", row.id)
        await self.db.commit()
        return await self.replenishment_view(row)

    async def receive(
        self, identifier: UUID, quantity: int, actor: UserResponse
    ) -> ReplenishmentView:
        await self.lock()
        row = require_found(
            await Replenishment.get(self.db, identifier, lock=True), "Replenishment"
        )
        if (
            row.status in ("completed", "cancelled")
            or quantity > row.quantity - row.received_quantity
        ):
            raise ConflictError(
                "Receipt exceeds the remaining quantity or replenishment is closed."
            )
        await self.adjust(
            row.stock_id,
            StockAdjustment(delta=quantity, reason=f"Replenishment receipt {row.id}"),
            actor,
            commit=False,
            kind="receipt",
        )
        row.received_quantity += quantity
        row.status = "completed" if row.received_quantity == row.quantity else "partial"
        from backend.services.orders import OrderService

        await OrderService(self.db).allocate_backorders()
        await self.db.commit()
        return await self.replenishment_view(row)

    async def transfer(
        self,
        source_id: UUID,
        destination_id: UUID,
        quantity: int,
        reason: str,
        actor: UserResponse,
    ) -> None:
        await self.expire()
        source = require_found(
            await Stock.get(self.db, source_id, lock=True), "Source stock"
        )
        if source.warehouse_id == destination_id:
            raise ValidationError("Choose a different destination warehouse.")
        destination = require_found(
            await self.db.get(Warehouse, destination_id), "Destination warehouse"
        )
        if not destination.active:
            raise ConflictError("Destination warehouse is inactive.")
        target = await self.db.scalar(
            select(Stock)
            .where(
                Stock.warehouse_id == destination_id,
                Stock.variant_id == source.variant_id,
            )
            .with_for_update()
        )
        if source.quantity_on_hand - source.quantity_reserved < quantity:
            raise ConflictError("Not enough available stock to transfer.")
        if not target:
            target = Stock(
                warehouse_id=destination_id,
                variant_id=source.variant_id,
                quantity_on_hand=0,
                quantity_reserved=0,
                reorder_point=source.reorder_point,
            )
            self.db.add(target)
            await self.db.flush()
        source.quantity_on_hand -= quantity
        target.quantity_on_hand += quantity
        for stock, delta in [(source, -quantity), (target, quantity)]:
            self.db.add(
                StockMovement(
                    stock_id=stock.id,
                    delta=delta,
                    kind="transfer",
                    reason=reason,
                    actor_id=actor.id,
                    reference=str(source.id),
                )
            )
            await self.synchronize_alert(stock)
        await audit(
            self.db,
            actor,
            "transfer",
            "stock",
            source.id,
            {
                "quantity": quantity,
                "destination": str(destination_id),
                "reason": reason,
            },
        )
        await self.db.commit()

    async def warehouse_detail(self, identifier: UUID) -> WarehouseView:
        from backend.models.commerce import Warehouse as Model

        return WarehouseView.model_validate(
            require_found(await Model.get(self.db, identifier), "Warehouse")
        )

    async def set_threshold(
        self, identifier: UUID, payload: ThresholdPatch, actor: UserResponse
    ) -> StockView:
        service = InventoryService(self.db)
        await service.lock()
        row = require_found(await StockModel.get(self.db, identifier, True), "Stock")
        row.reorder_point = payload.reorder_point
        await service.synchronize_alert(row)
        await audit(
            self.db,
            actor,
            "threshold",
            "stock",
            identifier,
            {"reorder_point": payload.reorder_point},
        )
        await self.db.commit()
        return await service.stock_view(row)

    async def movements(
        self,
    ) -> list[Movement]:
        rows = (
            await self.db.scalars(
                select(StockMovement)
                .order_by(StockMovement.created_at.desc())
                .limit(500)
            )
        ).all()
        return [Movement.model_validate(row) for row in rows]

    async def update_alert(
        self, identifier: UUID, payload: AlertPatch, actor: UserResponse
    ) -> Message:
        service = InventoryService(self.db)
        await service.lock()
        row = require_found(await AlertModel.get(self.db, identifier, True), "Alert")
        stock_row = require_found(await self.db.get(StockModel, row.stock_id), "Stock")
        if (
            payload.status == "resolved"
            and stock_row.quantity_on_hand - stock_row.quantity_reserved
            <= stock_row.reorder_point
        ):
            raise ConflictError(
                "Receive stock or change the threshold before resolving this alert."
            )
        row.status = payload.status
        await audit(
            self.db, actor, "status", "alerts", identifier, {"status": payload.status}
        )
        await self.db.commit()
        return Message(detail="Alert updated.")

    async def replenishments(
        self,
    ) -> list[ReplenishmentView]:
        rows = (
            await self.db.scalars(
                select(ReplenishmentModel).order_by(
                    ReplenishmentModel.created_at.desc()
                )
            )
        ).all()
        service = InventoryService(self.db)
        return [await service.replenishment_view(row) for row in rows]

    async def cancel_replenishment(
        self, identifier: UUID, actor: UserResponse
    ) -> Message:
        service = InventoryService(self.db)
        await service.lock()
        row = require_found(
            await ReplenishmentModel.get(self.db, identifier, True), "Replenishment"
        )
        if row.status == "completed":
            raise ConflictError("Completed replenishments cannot be cancelled.")
        row.status = "cancelled"
        await audit(self.db, actor, "cancel", "replenishments", identifier)
        await self.db.commit()
        return Message(detail="Replenishment cancelled.")
