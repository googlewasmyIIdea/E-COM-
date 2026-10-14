from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.core.config import Settings, get_settings


@lru_cache
def get_engine(database_url: str, schema: str = "") -> AsyncEngine:
    if not database_url:
        raise RuntimeError("Set DATABASE_URL in backend/.env before starting the API.")
    if schema:
        return create_async_engine(
            database_url,
            pool_pre_ping=True,
            connect_args={"server_settings": {"search_path": schema}},
        )
    return create_async_engine(database_url, pool_pre_ping=True)


async def get_session(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(
        get_engine(settings.database_url, settings.database_schema),
        expire_on_commit=False,
    )
    async with factory() as session:
        yield session
