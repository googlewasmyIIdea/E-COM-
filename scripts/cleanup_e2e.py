"""Drop only the UUID-named isolated QA schema created by prepare_e2e.py."""

import asyncio

from qa_state import STATE_PATH, read_state
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.core.config import get_settings


async def cleanup() -> None:
    if not STATE_PATH.exists():
        return
    state = read_state()
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{state.schema_name}" CASCADE'))
        STATE_PATH.unlink()
        print("Removed only the isolated QA schema and its temporary credential file.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(cleanup())
