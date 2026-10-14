"""Trusted local account role management; never exposed as a public signup operation."""

import argparse
import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.core.config import get_settings
from backend.db.session import get_engine
from backend.models.auth import User
from backend.models.commerce import AuditLog
from backend.services.common import require_found


async def promote(email: str, role: str, permissions: list[str]) -> None:
    engine = get_engine(get_settings().database_url, get_settings().database_schema)
    try:
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            user = require_found(
                await User.by_email(db, email.strip().lower()), "Account"
            )
            user.role = role
            user.permissions = permissions if role == "staff" else []
            db.add(
                AuditLog(
                    actor_id=None,
                    action="trusted_cli_role_change",
                    resource="customers",
                    resource_id=str(user.id),
                    detail={"role": role, "permissions": permissions},
                )
            )
            await db.commit()
            print(
                f"Updated role for {user.email}: {role}. Existing password and sessions were preserved."
            )
    finally:
        await engine.dispose()
        get_engine.cache_clear()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("--role", choices=["customer", "staff", "admin"], required=True)
    parser.add_argument(
        "--permissions", default="", help="Comma-separated permission names for staff."
    )
    args = parser.parse_args()
    asyncio.run(
        promote(
            args.email,
            args.role,
            [p.strip() for p in args.permissions.split(",") if p.strip()],
        )
    )


if __name__ == "__main__":
    main()
