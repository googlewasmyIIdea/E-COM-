from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from backend.core.exception import ConflictError, ValidationError
from backend.models.auth import User
from backend.models.commerce import (
    Category,
    Collection,
    Newsletter,
    Order,
    OrderItem,
    Product,
    ProductCollection,
    Promotion,
    Review,
    Setting,
    Stock,
    Variant,
    Warehouse,
)
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    Message,
    NewsletterInput,
    ProductInput,
    ProductPage,
    ProductResponse,
    Record,
    ReviewInput,
    ReviewResponse,
    TaxonomyResponse,
    VariantResponse,
)
from backend.services.common import audit, record, require_found, utc


class CatalogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def product(self, product: Product, detailed: bool = True) -> ProductResponse:
        variants = list(
            (
                await self.db.scalars(
                    select(Variant)
                    .where(Variant.product_id == product.id)
                    .order_by(Variant.created_at)
                )
            ).all()
        )
        quantities = (
            await self.db.execute(
                select(
                    Stock.variant_id,
                    func.sum(Stock.quantity_on_hand - Stock.quantity_reserved),
                )
                .join(Warehouse)
                .where(
                    Stock.variant_id.in_([v.id for v in variants]),
                    Warehouse.active.is_(True),
                )
                .group_by(Stock.variant_id)
            )
        ).all()
        available = {identifier: int(quantity) for identifier, quantity in quantities}
        variant_views = [
            VariantResponse.model_validate(v).model_copy(
                update={"available_stock": available.get(v.id, 0)}
            )
            for v in variants
        ]
        reviews = list(
            (
                await self.db.scalars(
                    select(Review)
                    .where(Review.product_id == product.id, Review.status == "approved")
                    .order_by(Review.created_at.desc())
                )
            ).all()
        )
        category = (
            await self.db.get(Category, product.category_id)
            if product.category_id
            else None
        )
        review_views: list[ReviewResponse] = []
        if detailed:
            for review in reviews:
                author = await self.db.get(User, review.user_id)
                review_views.append(
                    ReviewResponse.model_validate(review).model_copy(
                        update={
                            "author": author.name
                            if author and author.name
                            else "Customer"
                        }
                    )
                )
        collection_ids = list(
            (
                await self.db.scalars(
                    select(ProductCollection.collection_id).where(
                        ProductCollection.product_id == product.id
                    )
                )
            ).all()
        )
        return ProductResponse(
            id=product.id,
            name=product.name,
            slug=product.slug,
            description=product.description,
            category_id=product.category_id,
            category_name=category.name if category else "Stationery",
            brand=product.brand,
            images=product.images or ["/images/stationery-fallback.webp"],
            attributes=product.attributes,
            active=product.active,
            featured=product.featured,
            allow_backorder=product.allow_backorder,
            preorder=product.preorder,
            release_date=product.release_date,
            created_at=product.created_at,
            variants=variant_views,
            available_stock=sum(v.available_stock for v in variant_views if v.active),
            rating=(
                Decimal(sum(r.rating for r in reviews)) / Decimal(len(reviews))
            ).quantize(Decimal("0.1"))
            if reviews
            else None,
            review_count=len(reviews),
            reviews=review_views,
            collection_ids=collection_ids,
        )

    async def list_products(
        self,
        q: str = "",
        category: str = "",
        collection: str = "",
        brand: str = "",
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
        color: str = "",
        availability: str = "",
        sort: str = "newest",
        page: int = 1,
        page_size: int = 12,
        attribute: str = "",
        include_inactive: bool = False,
    ) -> ProductPage:
        statement = select(Product)
        if not include_inactive:
            statement = statement.where(Product.active.is_(True))
        if q:
            # Escape SQL wildcard characters so user text remains literal search text.
            escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            statement = statement.where(
                Product.name.ilike(f"%{escaped}%", escape="\\")
                | Product.description.ilike(f"%{escaped}%", escape="\\")
            )
        if category:
            category_row = await self.db.scalar(
                select(Category).where(Category.slug == category)
            )
            if not category_row:
                return ProductPage(items=[], total=0, page=page, page_size=page_size)
            descendants: set[UUID] = {category_row.id}
            tree = (
                await self.db.execute(
                    select(Category.id, Category.parent_id).where(
                        Category.active.is_(True)
                    )
                )
            ).all()
            changed = True
            while changed:
                changed = False
                for child_id, parent_id in tree:
                    if parent_id in descendants and child_id not in descendants:
                        descendants.add(child_id)
                        changed = True
            statement = statement.where(Product.category_id.in_(descendants))
        if collection:
            statement = (
                statement.join(ProductCollection)
                .join(Collection)
                .where(Collection.slug == collection, Collection.active.is_(True))
            )
        if brand:
            statement = statement.where(Product.brand == brand)
        variant_filter = select(Variant.product_id).where(Variant.active.is_(True))
        if min_price is not None:
            variant_filter = variant_filter.where(Variant.price >= min_price)
        if max_price is not None:
            variant_filter = variant_filter.where(Variant.price <= max_price)
        if color:
            variant_filter = variant_filter.where(
                Variant.attributes["color"].as_string().ilike(color)
            )
        if min_price is not None or max_price is not None or color:
            statement = statement.where(Product.id.in_(variant_filter))
        if attribute and ":" in attribute:
            key, value = attribute.split(":", 1)
            statement = statement.where(Product.attributes[key].as_string() == value)
        if availability:
            in_stock = (
                select(Variant.product_id)
                .join(Stock)
                .join(Warehouse)
                .where(
                    Stock.quantity_on_hand > Stock.quantity_reserved,
                    Variant.active.is_(True),
                    Warehouse.active.is_(True),
                )
            )
            statement = statement.where(
                Product.id.in_(in_stock)
                if availability == "in_stock"
                else Product.id.not_in(in_stock)
            )
        if sort == "featured":
            statement = statement.where(Product.featured.is_(True))
        min_variant_price = (
            select(func.min(Variant.price))
            .where(Variant.product_id == Product.id, Variant.active.is_(True))
            .correlate(Product)
            .scalar_subquery()
        )
        if sort == "price_asc":
            statement = statement.order_by(min_variant_price.asc())
        elif sort == "price_desc":
            statement = statement.order_by(min_variant_price.desc())
        elif sort == "name":
            statement = statement.order_by(Product.name)
        elif sort == "bestsellers":
            sales = (
                select(
                    Variant.product_id.label("product_id"),
                    func.sum(OrderItem.quantity).label("sold"),
                )
                .join(OrderItem, OrderItem.variant_id == Variant.id)
                .join(Order)
                .where(Order.status.not_in(["cancelled", "returned", "refunded"]))
                .group_by(Variant.product_id)
                .subquery()
            )
            statement = statement.join(
                sales, sales.c.product_id == Product.id
            ).order_by(sales.c.sold.desc())
        elif sort == "featured":
            statement = statement.order_by(Product.created_at.asc())
        else:
            statement = statement.order_by(Product.created_at.desc())
        count = await self.db.scalar(
            select(func.count()).select_from(statement.order_by(None).subquery())
        )
        rows = list(
            (
                await self.db.scalars(
                    statement.offset((page - 1) * page_size).limit(page_size)
                )
            ).all()
        )
        return ProductPage(
            items=[await self.product(p, detailed=False) for p in rows],
            total=int(count or 0),
            page=page,
            page_size=page_size,
        )

    async def recommendations(self, slug: str) -> list[ProductResponse]:
        selected = await self.detail(slug)
        category = (
            await self.db.get(Category, selected.category_id)
            if selected.category_id
            else None
        )
        page = await self.list_products(
            category=category.slug if category else "", page_size=5
        )
        return [item for item in page.items if item.id != selected.id][:4]

    async def bought_together(self, slug: str) -> list[ProductResponse]:
        selected = await self.detail(slug)
        source_line = aliased(OrderItem)
        source_variant = aliased(Variant)
        score = func.count(func.distinct(Order.id))
        statement = (
            select(Product)
            .join(Variant, Variant.product_id == Product.id)
            .join(OrderItem, OrderItem.variant_id == Variant.id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(source_line, source_line.order_id == Order.id)
            .join(source_variant, source_variant.id == source_line.variant_id)
            .where(
                source_variant.product_id == selected.id,
                Product.id != selected.id,
                Product.active.is_(True),
                Variant.active.is_(True),
                Order.status == "delivered",
                Order.payment_status == "paid",
            )
            .group_by(Product.id)
            .order_by(score.desc(), Product.name)
            .limit(4)
        )
        return [
            await self.product(item, detailed=False)
            for item in (await self.db.scalars(statement)).all()
        ]

    async def detail(self, slug: str) -> ProductResponse:
        product = require_found(
            await self.db.scalar(
                select(Product).where(Product.slug == slug, Product.active.is_(True))
            ),
            "Product",
        )
        return await self.product(product)

    async def create_product(
        self, payload: ProductInput, actor: UserResponse
    ) -> ProductResponse:
        if await self.db.scalar(select(Product.id).where(Product.slug == payload.slug)):
            raise ConflictError("A product with this slug already exists.")
        if payload.category_id:
            require_found(await self.db.get(Category, payload.category_id), "Category")
        product = Product(**payload.model_dump(exclude={"variants", "collection_ids"}))
        self.db.add(product)
        await self.db.flush()
        for data in payload.variants:
            if data.compare_at_price is not None and data.compare_at_price < data.price:
                raise ValidationError(
                    "Compare-at price must be at least the selling price."
                )
            self.db.add(Variant(product_id=product.id, **data.model_dump()))
        for collection_id in payload.collection_ids:
            require_found(await self.db.get(Collection, collection_id), "Collection")
            self.db.add(
                ProductCollection(product_id=product.id, collection_id=collection_id)
            )
        await audit(self.db, actor, "create", "products", product.id)
        await self.db.commit()
        return await self.product(product)

    async def taxonomies(self, resource: str) -> list[TaxonomyResponse]:
        model = Category if resource == "categories" else Collection
        rows = (
            await self.db.scalars(
                select(model).where(model.active.is_(True)).order_by(model.name)
            )
        ).all()
        return [TaxonomyResponse.model_validate(row) for row in rows]

    async def review(
        self, product_id: UUID, payload: ReviewInput, user: UserResponse
    ) -> ReviewResponse:
        require_found(await self.db.get(Product, product_id), "Product")
        if await self.db.scalar(
            select(Review.id).where(
                Review.product_id == product_id, Review.user_id == user.id
            )
        ):
            raise ConflictError("You have already reviewed this product.")
        purchased = await self.db.scalar(
            select(OrderItem.id)
            .join(Order)
            .join(Variant)
            .where(
                Order.user_id == user.id,
                Variant.product_id == product_id,
                Order.status == "delivered",
            )
            .limit(1)
        )
        review = Review(
            product_id=product_id,
            user_id=user.id,
            verified_purchase=purchased is not None,
            **payload.model_dump(),
        )
        self.db.add(review)
        await self.db.commit()
        return ReviewResponse.model_validate(review)

    async def newsletter(self, payload: NewsletterInput) -> None:
        email = str(payload.email).lower()
        existing = await self.db.scalar(
            select(Newsletter).where(Newsletter.email == email)
        )
        if existing:
            existing.active = True
            existing.consent = True
        else:
            self.db.add(Newsletter(email=email, consent=True))
        await self.db.commit()

    async def report_review(self, identifier: UUID, actor: UserResponse) -> Message:
        review = require_found(await Review.get(self.db, identifier, True), "Review")
        from backend.models.commerce import ReviewReport

        previous = await self.db.scalar(
            select(ReviewReport).where(
                ReviewReport.review_id == identifier, ReviewReport.user_id == actor.id
            )
        )
        if not previous:
            self.db.add(ReviewReport(review_id=identifier, user_id=actor.id))
            review.reports += 1
        await self.db.commit()
        return Message(detail="Review reported for moderation.")

    async def store_settings(
        self,
    ) -> list[Record]:
        rows = (
            await self.db.scalars(select(Setting).where(Setting.public.is_(True)))
        ).all()
        return [record(row) for row in rows]

    async def promotions(
        self,
    ) -> list[Record]:
        now = datetime.now(UTC)
        rows = (
            await self.db.scalars(select(Promotion).where(Promotion.active.is_(True)))
        ).all()
        return [
            record(row)
            for row in rows
            if (row.starts_at is None or utc(row.starts_at) <= now)
            and (row.expires_at is None or utc(row.expires_at) > now)
        ]

    async def approved_reviews(
        self,
    ) -> list[ReviewResponse]:
        from backend.models.auth import User

        rows = (
            await self.db.scalars(
                select(Review)
                .where(Review.status == "approved")
                .order_by(Review.created_at.desc())
                .limit(6)
            )
        ).all()
        result: list[ReviewResponse] = []
        for row in rows:
            user = await self.db.get(User, row.user_id)
            author = user.name.split()[0] if user and user.name else "Customer"
            result.append(
                ReviewResponse.model_validate(row).model_copy(update={"author": author})
            )
        return result
