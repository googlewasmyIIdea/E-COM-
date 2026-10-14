"""Idempotent development catalog. Never creates accounts or rewrites existing stock."""

import argparse
import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.core.config import get_settings
from backend.db.session import get_engine
from backend.models.auth import User  # noqa: F401
from backend.models.commerce import (
    Category,
    Collection,
    Coupon,
    Product,
    ProductCollection,
    Promotion,
    Setting,
    Stock,
    StockMovement,
    Variant,
    Warehouse,
)
from backend.services.inventory import InventoryService

CATALOG: list[tuple[str, str, str, list[tuple[str, int]]]] = [
    (
        "Pens & Writing",
        "pens-writing",
        "pens",
        [
            ("Pastel Gel Pen Set", 390),
            ("Everyday Fine Liner", 180),
            ("Classic Fountain Pen", 1290),
            ("Soft Highlight Marker Set", 450),
            ("Smooth Rollerball Pen", 290),
            ("Modern Calligraphy Kit", 990),
        ],
    ),
    (
        "Notebooks & Journals",
        "notebooks-journals",
        "journals",
        [
            ("Linen Dot Grid Journal", 650),
            ("Everyday Pocket Notebook", 240),
            ("Peach Spiral Notebook", 390),
            ("Recycled Paper Journal", 590),
            ("Quiet Thoughts Hardcover", 850),
            ("Minimal Meeting Notebook", 490),
        ],
    ),
    (
        "Planners & Organizers",
        "planners-organizers",
        "planners",
        [
            ("Undated Weekly Planner", 890),
            ("Daily Focus Planner", 790),
            ("Habit Tracker Notebook", 450),
            ("Desk Weekly Pad", 350),
            ("Academic Year Organizer", 1190),
            ("Little Goals Planner", 690),
        ],
    ),
    (
        "Art & Craft",
        "art-craft",
        "art",
        [
            ("Watercolor Studio Set", 1490),
            ("Creative Sketchbook", 690),
            ("Artist Brush Collection", 590),
            ("Soft Color Pencil Set", 850),
            ("Washi Tape Collection", 390),
            ("Handmade Paper Pack", 290),
        ],
    ),
    (
        "School Supplies",
        "school-supplies",
        "school",
        [
            ("Pastel Pencil Pouch", 590),
            ("Everyday Geometry Set", 490),
            ("Soft Eraser Trio", 120),
            ("Study Sticky Note Set", 240),
            ("Wooden Pencil Pack", 180),
            ("Clear Study Ruler", 90),
        ],
    ),
    (
        "Office Supplies",
        "office-supplies",
        "desk",
        [
            ("Minimal Document Folder", 390),
            ("Brass Binder Clip Set", 290),
            ("Office Memo Pad", 190),
            ("Cream Envelope Pack", 150),
            ("Desktop Letter Tray", 1190),
            ("Task Sticky Notes", 220),
        ],
    ),
    (
        "Desk Accessories",
        "desk-accessories",
        "desk",
        [
            ("Ceramic Pencil Cup", 890),
            ("Mint Desk Organizer", 1190),
            ("Blush Desk Mat", 1490),
            ("Little Book Stand", 990),
            ("Pastel Scissors", 390),
            ("Magnetic Clip Holder", 590),
        ],
    ),
    (
        "Gift Sets",
        "gift-sets",
        "gifts",
        [
            ("The Journaling Gift Box", 2490),
            ("Creative Beginnings Bundle", 2290),
            ("Study Day Essentials", 1690),
            ("A Little Thank You Set", 990),
            ("The Writer's Desk Kit", 2790),
            ("Pastel Desk Gift Box", 2990),
        ],
    ),
    (
        "Books",
        "books",
        "books",
        [
            ("A Little Book of Creativity", 790),
            ("Drawing for Quiet Mornings", 990),
            ("The Mindful Journal Companion", 890),
            ("Everyday Lettering Guide", 1190),
            ("Ideas Worth Keeping", 690),
            ("The Paper Craft Handbook", 1290),
        ],
    ),
]
COLLECTIONS: list[tuple[str, str, str]] = [
    ("Art & Creativity", "art-creativity", "art"),
    ("Back to School", "back-to-school", "school"),
    ("Journals & Planners", "journals-planners", "journals"),
    ("Desk Essentials", "desk-essentials", "desk"),
    ("Thoughtful Gifts", "thoughtful-gifts", "gifts"),
]


def slugify(value: str) -> str:
    return "-".join("".join(c.lower() if c.isalnum() else " " for c in value).split())


async def seed_catalog(db: AsyncSession) -> None:
    inventory = InventoryService(db)
    await inventory.lock()
    warehouse = await db.scalar(select(Warehouse).where(Warehouse.code == "DEV-KTM"))
    if warehouse is None:
        warehouse = Warehouse(
            name="Kathmandu Studio",
            code="DEV-KTM",
            location="Kathmandu",
            address="Development inventory location",
            active=True,
        )
        db.add(warehouse)
        await db.flush()
    collections: dict[str, Collection] = {}
    for name, slug, image in COLLECTIONS:
        collection = await db.scalar(select(Collection).where(Collection.slug == slug))
        if collection is None:
            collection = Collection(
                name=name,
                slug=slug,
                description=f"Thoughtfully selected {name.lower()} for brighter everyday moments.",
                image=f"/images/{image}.webp",
                active=True,
            )
            db.add(collection)
            await db.flush()
        collections[slug] = collection
    counter = 0
    for category_name, category_slug, image, products in CATALOG:
        category = await db.scalar(
            select(Category).where(Category.slug == category_slug)
        )
        if category is None:
            category = Category(
                name=category_name,
                slug=category_slug,
                description=f"Discover beautiful {category_name.lower()} for your creative routine.",
                image=f"/images/{image}.webp",
                active=True,
            )
            db.add(category)
            await db.flush()
        for index, (name, price) in enumerate(products):
            counter += 1
            slug = slugify(name)
            if await db.scalar(select(Product.id).where(Product.slug == slug)):
                continue
            attributes: dict[str, str | int] = {
                "material": "Thoughtfully selected materials",
                "pack_quantity": 1,
            }
            if image == "pens":
                attributes.update({"ink_color": "Black", "tip_size": "0.5 mm"})
            if image in ("journals", "planners"):
                attributes.update(
                    {"paper_size": "A5", "page_count": 160, "paper_weight": "100 gsm"}
                )
            if image == "books":
                attributes.update(
                    {
                        "author": "Paper & Petal Studio",
                        "language": "English",
                        "format": "Hardcover",
                        "page_count": 160,
                    }
                )
            product = Product(
                name=name,
                slug=slug,
                description=f"Bring a little joy to your everyday with the {name.lower()}. A considered companion for fresh ideas, thoughtful notes, and creative moments.\n\nThis is a development catalog sample. Product details and photographs should be replaced with verified merchandise before selling.",
                category_id=category.id,
                brand="Paper & Petal" if index % 2 == 0 else "Studio Paper",
                images=[f"/images/{image}.webp", "/images/stationery-hero.webp"],
                attributes=attributes,
                active=True,
                featured=index < 2,
                allow_backorder=False,
                preorder=False,
            )
            db.add(product)
            await db.flush()
            for number, color in enumerate(
                ["Lavender", "Mint"] if image != "books" else ["Cream"]
            ):
                amount = Decimal(price + number * 50).quantize(Decimal("0.01"))
                variant = Variant(
                    product_id=product.id,
                    sku=f"PP-{counter:03d}-{number + 1}",
                    name=color if image != "books" else "Hardcover",
                    price=amount,
                    compare_at_price=(amount * Decimal("1.20")).quantize(
                        Decimal("0.01")
                    )
                    if counter % 5 == 0
                    else None,
                    attributes={"color": color},
                    image=f"/images/{image}.webp",
                    active=True,
                )
                db.add(variant)
                await db.flush()
                stock = Stock(
                    warehouse_id=warehouse.id,
                    variant_id=variant.id,
                    quantity_on_hand=3 if counter % 13 == 0 else 20 + index,
                    quantity_reserved=0,
                    reorder_point=5,
                )
                db.add(stock)
                await db.flush()
                db.add(
                    StockMovement(
                        stock_id=stock.id,
                        delta=stock.quantity_on_hand,
                        kind="development_seed",
                        reason="Explicit development sample inventory",
                    )
                )
                await inventory.synchronize_alert(stock)
            collection_slug = {
                "art": "art-creativity",
                "school": "back-to-school",
                "journals": "journals-planners",
                "planners": "journals-planners",
                "desk": "desk-essentials",
                "gifts": "thoughtful-gifts",
            }.get(image)
            if collection_slug:
                db.add(
                    ProductCollection(
                        product_id=product.id,
                        collection_id=collections[collection_slug].id,
                    )
                )
    settings: dict[str, tuple[str, bool]] = {
        "brand_name": ("Paper & Petal", True),
        "announcement": (
            "A little joy, delivered. Free standard shipping on orders over NPR 2,500.",
            True,
        ),
        "shipping_standard": ("100.00", True),
        "free_shipping_threshold": ("2500.00", True),
        "contact_email": ("hello@paperandpetal.local", True),
        "store_description": ("Thoughtful stationery. Brighter everyday.", True),
        "development_catalog": ("true", True),
    }
    for key, (value, public) in settings.items():
        if not await db.scalar(select(Setting.id).where(Setting.key == key)):
            db.add(Setting(key=key, value=value, public=public))
    if not await db.scalar(select(Coupon.id).where(Coupon.code == "WELCOME10")):
        db.add(
            Coupon(
                code="WELCOME10",
                kind="percentage",
                value=Decimal("10"),
                min_spend=Decimal("500"),
                max_uses=100,
                uses=0,
                active=True,
            )
        )
    if not await db.scalar(
        select(Promotion.id).where(Promotion.name == "Creative beginnings")
    ):
        db.add(
            Promotion(
                name="Creative beginnings",
                headline="A fresh start for your creative side.",
                body="Discover art materials, blank pages, and little sparks of inspiration.",
                link="/shop?collection=art-creativity",
                image="/images/art.webp",
                active=True,
            )
        )
    await db.commit()


async def run_seed() -> None:
    engine = get_engine(get_settings().database_url, get_settings().database_schema)
    try:
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            await seed_catalog(db)
        print(
            "Development catalog seeded idempotently: 54 sample products. Existing merchandise, accounts, and stock quantities were preserved."
        )
    finally:
        await engine.dispose()
        get_engine.cache_clear()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--development",
        action="store_true",
        required=True,
        help="Explicitly acknowledge that these are sample products and stock.",
    )
    parser.parse_args()
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
