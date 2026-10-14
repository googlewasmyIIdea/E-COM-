from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.commerce import Address, Product, Wishlist
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import Message, Record
from backend.services.common import record, require_found


class CustomerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def addresses(self, actor: UserResponse) -> list[Record]:
        rows = (
            await self.db.scalars(
                select(Address)
                .where(Address.user_id == actor.id)
                .order_by(Address.created_at)
            )
        ).all()
        return [record(row) for row in rows]

    async def delete_address(self, identifier: UUID, actor: UserResponse) -> Message:
        address = require_found(
            await self.db.scalar(
                select(Address).where(
                    Address.id == identifier, Address.user_id == actor.id
                )
            ),
            "Address",
        )
        await self.db.delete(address)
        await self.db.commit()
        return Message(detail="Address removed.")

    async def wishlist(self, actor: UserResponse) -> list[Record]:
        rows = (
            await self.db.execute(
                select(Wishlist, Product)
                .join(Product)
                .where(Wishlist.user_id == actor.id, Product.active.is_(True))
            )
        ).all()
        return [
            Record(
                id=w.id,
                data={
                    "product_id": str(p.id),
                    "name": p.name,
                    "slug": p.slug,
                    "image": p.images[0]
                    if p.images
                    else "/images/stationery-fallback.webp",
                },
            )
            for w, p in rows
        ]

    async def add_wishlist(self, product_id: UUID, actor: UserResponse) -> Message:
        require_found(await self.db.get(Product, product_id), "Product")
        existing = await self.db.scalar(
            select(Wishlist).where(
                Wishlist.user_id == actor.id, Wishlist.product_id == product_id
            )
        )
        if not existing:
            self.db.add(Wishlist(user_id=actor.id, product_id=product_id))
            await self.db.commit()
        return Message(detail="Saved to your wishlist.")

    async def remove_wishlist(self, product_id: UUID, actor: UserResponse) -> Message:
        await self.db.execute(
            delete(Wishlist).where(
                Wishlist.user_id == actor.id, Wishlist.product_id == product_id
            )
        )
        await self.db.commit()
        return Message(detail="Removed from wishlist.")
