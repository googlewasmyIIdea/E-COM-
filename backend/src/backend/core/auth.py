from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import Settings, get_settings
from backend.core.exception import AuthenticationError
from backend.db.session import get_session
from backend.schemas.auth import UserResponse
from backend.services.auth import AuthService


def get_auth_service(
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(db, settings.session_hours)


def get_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
    ],
) -> str:
    if credentials is None:
        raise AuthenticationError("Please sign in to continue.")
    return credentials.credentials


async def require_user(
    token: Annotated[str, Depends(get_token)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> UserResponse:
    return await service.current_user(token)


class Permission:
    def __init__(self, permission: str) -> None:
        self.permission = permission

    async def __call__(
        self,
        user: Annotated[UserResponse, Depends(require_user)],
    ) -> UserResponse:
        from backend.core.exception import AuthorizationError

        if user.role == "admin":
            return user
        if user.role != "staff" or not (
            self.permission in user.permissions
            or (
                self.permission == "inventory.view"
                and "inventory.manage" in user.permissions
            )
        ):
            raise AuthorizationError("You do not have permission to access this area.")
        return user


async def optional_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
    ],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> UserResponse | None:
    return await service.current_user(credentials.credentials) if credentials else None
