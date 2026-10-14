"""Start the isolated QA API; never use the normal application's schema."""

import os

import uvicorn
from qa_state import read_state


def main() -> None:
    state = read_state()
    os.environ["DATABASE_SCHEMA"] = state.schema_name
    os.environ["APP_ORIGIN"] = state.base_url
    os.environ["PUBLIC_API_URL"] = "http://127.0.0.1:8101"
    os.environ["SMTP_HOST"] = ""
    os.environ["MAIL_DIR"] = "/tmp/ecommerce-e2e-mailbox"
    os.environ["UPLOAD_DIR"] = "/tmp/ecommerce-e2e-media"
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8101)


if __name__ == "__main__":
    main()
