from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from pydantic import JsonValue
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exception import NotFoundError
from backend.models.commerce import AuditLog, Entity
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import Record


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, datetime):
        return utc(value).isoformat()
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    raise TypeError("Unsupported record value")


def record(row: Entity, exclude: set[str] | None = None) -> Record:
    excluded = exclude or set()
    mapper = inspect(type(row))
    data: dict[str, JsonValue] = {}
    for column in mapper.columns:
        if column.key not in excluded:
            data[column.key] = json_value(cast(object, getattr(row, column.key)))
    return Record(id=row.id, data=data)


async def audit(
    db: AsyncSession,
    actor: UserResponse | None,
    action: str,
    resource: str,
    identifier: UUID | str,
    detail: dict[str, JsonValue] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            resource=resource,
            resource_id=str(identifier),
            detail=detail or {},
        )
    )


def require_found[T](value: T | None, resource: str) -> T:
    if value is None:
        raise NotFoundError(f"{resource} was not found.")
    return value
