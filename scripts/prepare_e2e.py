"""Create an isolated QA schema and private ephemeral credentials; never reset app data."""

import asyncio
import secrets
from uuid import uuid4

from qa_state import STATE_PATH, QAState
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.config import get_settings
from backend.models.auth import User
from backend.models.base import Base
from backend.seed import seed_catalog
from backend.services.auth import AuthService

STATE = STATE_PATH


async def prepare() -> None:
    if STATE.exists():
        print(
            "Existing isolated QA state found; reuse it or clean it before preparing another run."
        )
        return
    schema = "commerce_e2e_" + uuid4().hex
    url = get_settings().database_url
    control = create_async_engine(url)
    async with control.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(
        url, connect_args={"server_settings": {"search_path": schema}}
    )
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        password = secrets.token_urlsafe(24)
        email = "qa-admin@example.com"
        async with factory() as db:
            await seed_catalog(db)
            created = await AuthService(db, 8).create_user(email, password)
            user = await db.get(User, created.id)
            assert user is not None
            user.role = "admin"
            user.name = "Isolated QA Administrator"
            await db.commit()
        STATE.write_text(
            QAState(
                schema=schema, admin_email=email, admin_password=password
            ).model_dump_json(by_alias=True)
        )
        STATE.chmod(0o600)
        print(
            "Prepared isolated PostgreSQL QA schema and private temporary test credentials."
        )
    finally:
        await engine.dispose()
        await control.dispose()


if __name__ == "__main__":
    asyncio.run(prepare())
