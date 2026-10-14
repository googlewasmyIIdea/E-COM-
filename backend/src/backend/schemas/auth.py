from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    JsonValue,
    SecretStr,
    field_validator,
)


class AuthSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class LoginRequest(AuthSchema):
    email: EmailStr = Field(max_length=254)
    password: SecretStr = Field(min_length=1, max_length=1024)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class UserResponse(AuthSchema):
    id: UUID
    email: str
    role: str = "customer"
    name: str = ""
    phone: str = ""
    permissions: list[str] = Field(default_factory=list)
    preferences: dict[str, JsonValue] = Field(default_factory=dict)
    email_verified: bool = False


class LoginResponse(AuthSchema):
    session_token: str
    expires_at: datetime
    user: UserResponse


class LogoutResponse(AuthSchema):
    detail: str = "Signed out"
