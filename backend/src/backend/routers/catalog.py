from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import require_user
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import (
    Message,
    NewsletterInput,
    ProductPage,
    ProductResponse,
    Record,
    ReviewInput,
    ReviewResponse,
    TaxonomyResponse,
)
from backend.services.catalog import CatalogService

router = APIRouter(tags=["storefront"])
DB = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[UserResponse, Depends(require_user)]


@router.get("/catalog/products", response_model=ProductPage)
async def products(
    db: DB,
    q: str = "",
    category: str = "",
    collection: str = "",
    brand: str = "",
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    color: str = "",
    availability: str = "",
    sort: str = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    attribute: str = "",
) -> ProductPage:
    return await CatalogService(db).list_products(
        q,
        category,
        collection,
        brand,
        min_price,
        max_price,
        color,
        availability,
        sort,
        page,
        page_size,
        attribute,
    )


@router.get("/catalog/products/{slug}", response_model=ProductResponse)
async def product(slug: str, db: DB) -> ProductResponse:
    return await CatalogService(db).detail(slug)


@router.get("/catalog/categories", response_model=list[TaxonomyResponse])
async def categories(db: DB) -> list[TaxonomyResponse]:
    return await CatalogService(db).taxonomies("categories")


@router.get("/catalog/collections", response_model=list[TaxonomyResponse])
async def collections(db: DB) -> list[TaxonomyResponse]:
    return await CatalogService(db).taxonomies("collections")


@router.get("/catalog/recommendations/{slug}", response_model=list[ProductResponse])
async def recommendations(slug: str, db: DB) -> list[ProductResponse]:
    return await CatalogService(db).recommendations(slug)


@router.get("/catalog/bought-together/{slug}", response_model=list[ProductResponse])
async def bought_together(slug: str, db: DB) -> list[ProductResponse]:
    return await CatalogService(db).bought_together(slug)


@router.post(
    "/catalog/products/{identifier}/reviews",
    response_model=ReviewResponse,
    status_code=201,
)
async def create_review(
    identifier: UUID, payload: ReviewInput, actor: Actor, db: DB
) -> ReviewResponse:
    return await CatalogService(db).review(identifier, payload, actor)


@router.post("/catalog/reviews/{identifier}/report", response_model=Message)
async def report_review(identifier: UUID, actor: Actor, db: DB) -> Message:
    return await CatalogService(db).report_review(identifier, actor)


@router.get("/store/settings", response_model=list[Record])
async def store_settings(db: DB) -> list[Record]:
    return await CatalogService(db).store_settings()


@router.get("/store/promotions", response_model=list[Record])
async def promotions(db: DB) -> list[Record]:
    return await CatalogService(db).promotions()


@router.post("/newsletter", response_model=Message)
async def newsletter(payload: NewsletterInput, db: DB) -> Message:
    await CatalogService(db).newsletter(payload)
    return Message(
        detail="You are subscribed. Thank you for joining our paper-loving community."
    )


@router.get("/store/reviews", response_model=list[ReviewResponse])
async def approved_reviews(db: DB) -> list[ReviewResponse]:
    return await CatalogService(db).approved_reviews()
