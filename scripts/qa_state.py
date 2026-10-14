"""Private, validated state for explicitly prepared isolated browser tests."""

from pathlib import Path

from pydantic import BaseModel, Field

STATE_PATH = Path("/tmp/ecommerce-e2e-state.json")


class QAState(BaseModel):
    schema_name: str = Field(alias="schema", pattern=r"^commerce_e2e_[0-9a-f]{32}$")
    admin_email: str
    admin_password: str
    base_url: str = "http://127.0.0.1:3100"


def read_state() -> QAState:
    return QAState.model_validate_json(STATE_PATH.read_text())
