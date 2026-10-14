# Paper & Petal API

Typed async FastAPI / SQLAlchemy / PostgreSQL backend. Run `uv sync`, `uv run alembic upgrade head`, and `uv run uvicorn backend.main:app --reload` from this directory. Preserve an existing `.env`; see `.env.example` for required database and optional email/payment settings.

See [../README.md](../README.md) for account creation/promotion, development seeding, inventory policy, Docker, tests and external integration requirements. [../API-CONTRACT.md](../API-CONTRACT.md) describes the versioned API. `/docs` exposes the live OpenAPI specification.
