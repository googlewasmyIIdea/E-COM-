from typing import Annotated

from fastapi import APIRouter, Depends

from backend.core.auth import get_auth_service, get_token, require_user
from backend.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    UserResponse,
)
from backend.schemas.inventory import ErrorResponse
from backend.services.auth import AuthService

router = APIRouter(
    prefix="/auth", tags=["authentication"], responses={401: {"model": ErrorResponse}}
)


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> LoginResponse:
    return await service.login(payload)


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[UserResponse, Depends(require_user)]) -> UserResponse:
    return user


@router.post(
    "/logout", response_model=LogoutResponse, dependencies=[Depends(require_user)]
)
async def logout(
    token: Annotated[str, Depends(get_token)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> LogoutResponse:
    await service.logout(token)
    return LogoutResponse()
