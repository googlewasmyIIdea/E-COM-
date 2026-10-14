import argparse
import asyncio
from getpass import getpass

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.core.config import get_settings
from backend.core.exception import ConflictError
from backend.db.session import get_engine
from backend.services.auth import AuthService


async def create_user(email: str, password: str) -> None:
    settings = get_settings()
    engine = get_engine(settings.database_url, settings.database_schema)
    try:
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            user = await AuthService(db, settings.session_hours).create_user(
                email, password
            )
            print(f"Created account: {user.email}")
    finally:
        await engine.dispose()
        get_engine.cache_clear()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an inventory user.")
    parser.add_argument("email")
    args = parser.parse_args()
    password = getpass("Password (at least 6 characters): ")
    if password != getpass("Confirm password: "):
        parser.exit(1, "Passwords do not match.\n")
    try:
        asyncio.run(create_user(args.email, password))
    except (ConflictError, ValidationError, ValueError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
