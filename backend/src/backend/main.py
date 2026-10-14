import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from backend.core.config import get_settings
from backend.core.exception import AuthenticationError, DomainError
from backend.db.session import get_engine
from backend.routers.accounts import router as accounts_router
from backend.routers.admin import router as admin_router
from backend.routers.auth import router as auth_router
from backend.routers.catalog import router as catalog_router
from backend.routers.inventory import router as inventory_router
from backend.routers.payments import router as payments_router
from backend.routers.shopping import router as shopping_router
from backend.schemas.inventory import ErrorResponse


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    Path(get_settings().upload_dir).mkdir(parents=True, exist_ok=True)
    engine = get_engine(get_settings().database_url, get_settings().database_schema)
    from backend.worker import run_worker

    worker = asyncio.create_task(run_worker(engine, get_settings()))
    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker
        await engine.dispose()
        get_engine.cache_clear()


app = FastAPI(title="Paper & Petal Commerce API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in get_settings().cors_origins.split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Guest-Cart"],
)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")


@app.middleware("http")
async def disable_sensitive_caching(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    response = ErrorResponse(detail=str(exc))
    headers = (
        {"WWW-Authenticate": "Bearer"} if isinstance(exc, AuthenticationError) else None
    )
    return JSONResponse(
        status_code=exc.status_code, content=response.model_dump(), headers=headers
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Do not echo request inputs: login validation failures can contain passwords.
    response = ErrorResponse(detail="Invalid request. Check the submitted fields.")
    return JSONResponse(status_code=422, content=response.model_dump())


app.include_router(accounts_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(shopping_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.mount(
    "/media",
    StaticFiles(directory=get_settings().upload_dir, check_dir=False),
    name="media",
)


@app.exception_handler(PydanticValidationError)
async def schema_error_handler(
    request: Request, exc: PydanticValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            detail="Invalid fields. Check the submitted values."
        ).model_dump(),
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(
    request: Request, exc: IntegrityError
) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content=ErrorResponse(
            detail="This record conflicts with an existing record or is still referenced."
        ).model_dump(),
    )


app.include_router(payments_router, prefix="/api/v1")
