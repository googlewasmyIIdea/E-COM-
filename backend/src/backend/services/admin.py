from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from pydantic import JsonValue, TypeAdapter
from sqlalchemy import delete, func, inspect, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exception import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from backend.models.auth import User
from backend.models.commerce import (
    AuditLog,
    Category,
    Collection,
    Coupon,
    Entity,
    Newsletter,
    Notification,
    Order,
    Payment,
    Product,
    ProductCollection,
    Promotion,
    ReturnRequest,
    Review,
    Setting,
    Variant,
)
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    CouponInput,
    CustomerPatch,
    OrderResponse,
    Overview,
    ProductInput,
    ProductResponse,
    PromotionInput,
    Record,
    RecordList,
    SettingInput,
    TaxonomyInput,
    VariantInput,
)
from backend.services.auth import AuthService
from backend.services.catalog import CatalogService
from backend.services.common import audit, json_value, record, require_found
from backend.services.inventory import InventoryService
from backend.services.orders import OrderService

MODELS: dict[str, type[Entity]] = {
    "products": Product,
    "variants": Variant,
    "categories": Category,
    "collections": Collection,
    "coupons": Coupon,
    "promotions": Promotion,
    "reviews": Review,
    "returns": ReturnRequest,
    "orders": Order,
    "payments": Payment,
    "settings": Setting,
    "notifications": Notification,
    "newsletter": Newsletter,
    "audit": AuditLog,
}
PERMISSIONS = {
    "products": "catalog.manage",
    "variants": "catalog.manage",
    "categories": "catalog.manage",
    "collections": "catalog.manage",
    "coupons": "marketing.manage",
    "promotions": "marketing.manage",
    "reviews": "reviews.manage",
    "returns": "orders.manage",
    "orders": "orders.manage",
    "payments": "payments.view",
    "settings": "settings.manage",
    "customers": "customers.manage",
    "notifications": "notifications.view",
    "newsletter": "marketing.manage",
    "audit": "audit.view",
}


def authorize(resource: str, actor: UserResponse) -> None:
    permission = PERMISSIONS.get(resource)
    if not permission:
        raise NotFoundError("Management resource not found.")
    if actor.role == "admin":
        return
    if actor.role != "staff" or permission not in actor.permissions:
        raise AuthorizationError("You do not have permission to manage this resource.")


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        resource: str,
        actor: UserResponse,
        q: str = "",
        page: int = 1,
        page_size: int = 30,
    ) -> RecordList:
        authorize(resource, actor)
        if resource in ("orders", "returns"):
            await InventoryService(self.db).lock()
        if resource == "customers":
            statement = select(User)
            if q:
                statement = statement.where(
                    User.email.ilike(f"%{q}%") | User.name.ilike(f"%{q}%")
                )
            total = await self.db.scalar(
                select(func.count()).select_from(statement.subquery())
            )
            users = (
                await self.db.scalars(
                    statement.order_by(User.email)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
            return RecordList(
                items=[
                    Record(
                        id=user.id,
                        data=TypeAdapter(dict[str, JsonValue]).validate_python(
                            {
                                **AuthService.user_response(user).model_dump(
                                    mode="json"
                                ),
                                "is_active": user.is_active,
                            }
                        ),
                    )
                    for user in users
                ],
                total=int(total or 0),
            )
        model = require_found(MODELS.get(resource), "Resource")
        query = select(model)
        if q:
            columns = [
                column
                for column in inspect(model).columns
                if column.type.python_type is str
                and column.key not in {"body", "response"}
            ]
            if columns:
                query = query.where(
                    or_(*(column.ilike(f"%{q}%") for column in columns))
                )
        count = await self.db.scalar(select(func.count()).select_from(query.subquery()))
        rows = (
            await self.db.scalars(
                query.order_by(model.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
        return RecordList(
            items=[
                record(row, {"body"} if resource == "notifications" else set())
                for row in rows
            ],
            total=int(count or 0),
        )

    async def create(
        self, resource: str, data: dict[str, JsonValue], actor: UserResponse
    ) -> Record | ProductResponse:
        authorize(resource, actor)
        if resource == "products":
            return await CatalogService(self.db).create_product(
                ProductInput.model_validate(data), actor
            )
        if resource in ("categories", "collections"):
            values = TaxonomyInput.model_validate(data).model_dump()
            if resource == "collections":
                values.pop("parent_id", None)
            elif values.get("parent_id"):
                require_found(
                    await self.db.get(Category, values["parent_id"]), "Parent category"
                )
        elif resource == "variants":
            product_id = UUID(str(data.get("product_id")))
            require_found(await self.db.get(Product, product_id), "Product")
            values = VariantInput.model_validate(
                {key: value for key, value in data.items() if key != "product_id"}
            ).model_dump()
            values["product_id"] = product_id
        elif resource == "coupons":
            payload = CouponInput.model_validate(data)
            if payload.kind == "percentage" and payload.value > 100:
                raise ValidationError("Percentage discount cannot exceed 100.")
            values = payload.model_dump()
            values["code"] = payload.code.upper()
        elif resource == "promotions":
            values = PromotionInput.model_validate(data).model_dump()
        elif resource == "settings":
            values = SettingInput.model_validate(data).model_dump()
        else:
            raise ValidationError(
                "This resource is created through its dedicated workflow."
            )
        model = require_found(MODELS.get(resource), "Resource")
        row = model(**values)
        self.db.add(row)
        await self.db.flush()
        await audit(self.db, actor, "create", resource, row.id)
        await self.db.commit()
        return record(row)

    async def update(
        self,
        resource: str,
        identifier: UUID,
        data: dict[str, JsonValue],
        actor: UserResponse,
    ) -> Record | ProductResponse | OrderResponse:
        authorize(resource, actor)
        if resource in ("orders", "returns"):
            await InventoryService(self.db).lock()
        if resource == "customers":
            if actor.role != "admin":
                raise AuthorizationError(
                    "Only administrators can change customer roles and account status."
                )
            user = require_found(await self.db.get(User, identifier), "Customer")
            if identifier == actor.id and (
                data.get("role", actor.role) != "admin"
                or data.get("is_active") is False
            ):
                raise ConflictError("You cannot remove your own administrator access.")
            allowed = {"name", "phone", "role", "permissions", "is_active"}
            if any(key not in allowed for key in data):
                raise ValidationError("Unsupported customer field.")
            data = TypeAdapter(dict[str, JsonValue]).validate_python(
                CustomerPatch.model_validate(data).model_dump(exclude_unset=True)
            )
            for key, value in data.items():
                if key == "role" and value not in ("customer", "staff", "admin"):
                    raise ValidationError("Invalid role.")
                if key == "permissions" and (
                    not isinstance(value, list)
                    or any(not isinstance(item, str) for item in value)
                ):
                    raise ValidationError("Permissions must be a list of names.")
                if key == "is_active" and not isinstance(value, bool):
                    raise ValidationError("Account status must be a boolean.")
                setattr(user, key, value)
            await audit(
                self.db,
                actor,
                "update",
                "customers",
                identifier,
                {key: value for key, value in data.items() if key != "phone"},
            )
            await self.db.commit()
            return Record(
                id=user.id,
                data=TypeAdapter(dict[str, JsonValue]).validate_python(
                    {
                        **AuthService.user_response(user).model_dump(mode="json"),
                        "is_active": user.is_active,
                    }
                ),
            )
        model = require_found(MODELS.get(resource), "Resource")
        row = require_found(await model.get(self.db, identifier, True), "Record")
        if isinstance(row, Order):
            allowed = {"status", "tracking_number", "notes"}
            if any(key not in allowed for key in data):
                raise ValidationError("Unsupported order field.")
            status = str(data.get("status", row.status))
            return await OrderService(self.db).transition(
                row,
                status,
                actor,
                str(data["tracking_number"]) if data.get("tracking_number") else None,
                str(data["notes"]) if "notes" in data else None,
            )
        if isinstance(row, Product):
            base = await CatalogService(self.db).product(row)
            current: dict[str, JsonValue] = TypeAdapter(
                dict[str, JsonValue]
            ).validate_python(
                base.model_dump(
                    mode="json",
                    exclude={
                        "id",
                        "created_at",
                        "category_name",
                        "available_stock",
                        "rating",
                        "review_count",
                        "reviews",
                        "variants",
                    },
                )
            )
            variants = (
                await self.db.scalars(
                    select(Variant).where(Variant.product_id == row.id)
                )
            ).all()
            current["variants"] = [
                TypeAdapter(dict[str, JsonValue]).validate_python(
                    {
                        key: json_value(getattr(v, key))
                        for key in VariantInput.model_fields
                    }
                )
                for v in variants
            ]
            merged = ProductInput.model_validate({**current, **data})
            for key, value in merged.model_dump(
                exclude={"variants", "collection_ids"}
            ).items():
                setattr(row, key, value)
            await self.db.execute(
                delete(ProductCollection).where(ProductCollection.product_id == row.id)
            )
            for collection_id in merged.collection_ids:
                require_found(
                    await self.db.get(Collection, collection_id), "Collection"
                )
                self.db.add(
                    ProductCollection(product_id=row.id, collection_id=collection_id)
                )
            if "variants" in data:
                incoming = {item.sku: item for item in merged.variants}
                for variant in variants:
                    if variant.sku not in incoming:
                        variant.active = False
                for sku, variant_payload in incoming.items():
                    existing = next((v for v in variants if v.sku == sku), None)
                    if existing:
                        for key, field in variant_payload.model_dump().items():
                            setattr(existing, key, field)
                    else:
                        self.db.add(
                            Variant(product_id=row.id, **variant_payload.model_dump())
                        )
            await audit(self.db, actor, "update", resource, identifier)
            await self.db.commit()
            return await CatalogService(self.db).product(row)
        if isinstance(row, Review):
            if set(data) != {"status"} or data["status"] not in (
                "pending",
                "approved",
                "rejected",
            ):
                raise ValidationError("Choose a valid moderation status.")
            row.status = str(data["status"])
        elif isinstance(row, ReturnRequest):
            if set(data) - {"status", "notes"}:
                raise ValidationError("Unsupported return field.")
            status = str(data.get("status", row.status))
            transitions = {
                "requested": {"approved", "rejected"},
                "approved": {"received"},
                "received": {"refunded"},
                "rejected": set(),
                "refunded": set(),
            }
            if status != row.status and status not in transitions.get(
                row.status, set()
            ):
                raise ConflictError("Invalid return transition.")
            order = require_found(await Order.get(self.db, row.order_id, True), "Order")
            if status == "received":
                await OrderService(self.db).transition(order, "returned", actor)
            if status == "refunded":
                await OrderService(self.db).transition(order, "refunded", actor)
            row.status = status
            if "notes" in data:
                row.notes = str(data["notes"])
        elif isinstance(
            row, (Category, Collection, Variant, Coupon, Promotion, Setting)
        ):
            current = record(row).data
            current.pop("id", None)
            current.pop("created_at", None)
            current.pop("updated_at", None)
            if isinstance(row, Variant):
                current.pop("product_id", None)
            if isinstance(row, Coupon):
                current.pop("uses", None)
            if isinstance(row, Category) or isinstance(row, Collection):
                values = TaxonomyInput.model_validate({**current, **data}).model_dump()
                if isinstance(row, Collection):
                    values.pop("parent_id", None)
            elif isinstance(row, Variant):
                values = VariantInput.model_validate({**current, **data}).model_dump()
            elif isinstance(row, Coupon):
                payload = CouponInput.model_validate({**current, **data})
                if payload.kind == "percentage" and payload.value > 100:
                    raise ValidationError("Percentage discount cannot exceed 100.")
                values = payload.model_dump()
                values["code"] = payload.code.upper()
            elif isinstance(row, Promotion):
                values = PromotionInput.model_validate({**current, **data}).model_dump()
            else:
                values = SettingInput.model_validate({**current, **data}).model_dump()
            if isinstance(row, Category) and values.get("parent_id"):
                cursor = values["parent_id"]
                visited: set[UUID] = {row.id}
                while cursor is not None:
                    if cursor in visited:
                        raise ConflictError("Category parents cannot form a cycle.")
                    visited.add(cursor)
                    parent = require_found(
                        await self.db.get(Category, cursor), "Parent category"
                    )
                    cursor = parent.parent_id
            for key, value in values.items():
                setattr(row, key, value)
        else:
            raise ValidationError("This resource is read-only.")
        await audit(self.db, actor, "update", resource, identifier)
        await self.db.commit()
        return record(row)

    async def remove(
        self, resource: str, identifier: UUID, actor: UserResponse
    ) -> None:
        authorize(resource, actor)
        model = require_found(MODELS.get(resource), "Resource")
        row = require_found(await model.get(self.db, identifier, True), "Record")
        if isinstance(row, (Product, Variant, Category, Collection, Coupon, Promotion)):
            row.active = False
        elif isinstance(row, (Setting, Review)):
            await self.db.delete(row)
        else:
            raise ConflictError(
                "This record has permanent history and cannot be deleted."
            )
        await audit(
            self.db,
            actor,
            "deactivate" if hasattr(row, "active") else "delete",
            resource,
            identifier,
        )
        await self.db.commit()

    async def overview(self) -> Overview:
        from backend.models.commerce import Alert, Reservation

        async def count(model: type[Entity]) -> int:
            return int(
                await self.db.scalar(select(func.count()).select_from(model)) or 0
            )

        products = await count(Product)
        customers = int(
            await self.db.scalar(
                select(func.count()).select_from(User).where(User.role == "customer")
            )
            or 0
        )
        orders_count = await count(Order)
        revenue = await self.db.scalar(
            select(func.sum(Order.total)).where(
                Order.payment_status == "paid",
                Order.status.not_in(["cancelled", "returned", "refunded"]),
            )
        )
        low_stock = int(
            await self.db.scalar(
                select(func.count())
                .select_from(Alert)
                .where(Alert.status != "resolved")
            )
            or 0
        )
        active_reservations = int(
            await self.db.scalar(
                select(func.count())
                .select_from(Reservation)
                .where(Reservation.status == "active")
            )
            or 0
        )
        pending = int(
            await self.db.scalar(
                select(func.count())
                .select_from(Order)
                .where(
                    Order.status.in_(
                        [
                            "pending_payment",
                            "processing",
                            "awaiting_stock",
                            "awaiting_release",
                            "paid",
                        ]
                    )
                )
            )
            or 0
        )
        recent = (
            await self.db.scalars(
                select(Order).order_by(Order.created_at.desc()).limit(6)
            )
        ).all()
        daily: list[dict[str, JsonValue]] = []
        local_timezone = timezone(timedelta(hours=5, minutes=45))
        for offset in range(6, -1, -1):
            start = (datetime.now(local_timezone) - timedelta(days=offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            total = await self.db.scalar(
                select(func.sum(Order.total))
                .join(Payment)
                .where(
                    Payment.verified_at >= start,
                    Payment.verified_at < start + timedelta(days=1),
                    Order.payment_status == "paid",
                    Order.status.not_in(["cancelled", "returned", "refunded"]),
                )
            )
            daily.append(
                {
                    "date": start.date().isoformat(),
                    "revenue": str(total or Decimal("0.00")),
                }
            )
        return Overview(
            products=products,
            customers=customers,
            orders=orders_count,
            revenue=revenue or Decimal("0.00"),
            low_stock=low_stock,
            active_reservations=active_reservations,
            pending_orders=pending,
            recent_orders=[await OrderService(self.db).view(row) for row in recent],
            revenue_by_day=daily,
        )

    async def get_record(
        self, resource: str, identifier: UUID, actor: UserResponse
    ) -> Record | ProductResponse | OrderResponse:
        from backend.models.commerce import Order, Product
        from backend.services.admin import MODELS
        from backend.services.catalog import CatalogService
        from backend.services.common import record, require_found
        from backend.services.orders import OrderService

        authorize(resource, actor)
        model = require_found(MODELS.get(resource), "Resource")
        row = require_found(await model.get(self.db, identifier), "Record")
        if isinstance(row, Product):
            return await CatalogService(self.db).product(row)
        if isinstance(row, Order):
            return await OrderService(self.db).view(row)
        return record(row, {"body"} if resource == "notifications" else set())
