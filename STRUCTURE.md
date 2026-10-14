# Application structure

The original feature-based Next.js / typed FastAPI architecture is retained. Backend and frontend are separate Git repositories. Root orchestration and project documents describe their shared contract.

```text
.
├── AI.md / AI-module.md             Project harness and inventory requirements
├── README.md                       Setup, credentials, QA, deployment requirements
├── API-CONTRACT.md                  Commerce, account, inventory, admin endpoints
├── AUTH-CONTRACT.md                 Preserved sessions and role extensions
├── IMPLEMENTATION-PROGRESS.md       Completion and verified results
├── ASSETS.md                        Development image provenance
├── docker-compose.yml              Frontend / backend / PostgreSQL / persistent volumes
├── scripts/                        Isolated PostgreSQL Playwright setup/start/cleanup
├── backend/
│   ├── src/backend/
│   │   ├── main.py                 Versioned API, middleware, errors, media, worker lifecycle
│   │   ├── core/                   Settings, auth/permissions, custom exceptions
│   │   ├── db/                     Async SQLAlchemy engine/session DI
│   │   ├── models/                 Auth + catalog/cart/inventory/order/payment/engagement tables
│   │   ├── schemas/                Strict Pydantic v2 request/response models
│   │   ├── routers/                Auth, accounts, catalog, shopping, inventory, admin, payments
│   │   ├── services/               Typed feature classes and transaction/business logic
│   │   ├── cli.py / manage.py      Explicit private account creation and trusted role changes
│   │   ├── seed.py                 Idempotent development catalog, no fake reviews/revenue
│   │   └── worker.py               Reservation expiry, allocation, pending-order cleanup, email
│   ├── alembic/versions/           Original auth + additive commerce migrations
│   └── tests/                     Auth/security/workflows + opt-in PostgreSQL concurrency
└── frontend/
    ├── app/
    │   ├── page.tsx               Public storefront /
    │   ├── (store)/               Shop, products, cart, checkout, account, auth recovery, policies
    │   ├── login/                 Preserved login route with updated storefront styling
    │   ├── admin/                 Overview, analytics, role-protected resource screens
    │   ├── inventory/             Existing URLs, now real management screens + movements
    │   ├── api/auth/              Same-origin login/logout/register cookie handlers
    │   ├── api/commerce/          Allowlisted same-origin authenticated/guest API proxy
    │   ├── api/inventory/         Preserved compatibility proxy
    │   └── media/                 Validated product image proxy
    ├── features/
    │   ├── auth/                  Existing sessions/client/schemas + account forms
    │   ├── commerce/              Typed contracts, browser/server clients, secure proxy
    │   ├── storefront/            Data-backed storefront/customer components
    │   ├── admin/                 Shared role-aware tables, editors, overview and forms
    │   └── inventory/             Original contract/helpers retained
    ├── components/ui/             Shared button/input/modal/empty states
    ├── public/images/             Local optimized sample photography and fallback
    ├── tests/                     Auth, proxy, cart bootstrap, storefront component tests
    └── e2e/                       Desktop/mobile browser shopping and management flow
```

Server components fetch FastAPI data with private `API_INTERNAL_URL`; browser components call same-origin route handlers. Session tokens remain in HttpOnly cookies. The backend enforces permissions independently of page guards. Public pages do not require login. `/account` requires an account; `/inventory` and `/admin` additionally require staff permissions or administrator role.

Products and SKU variants unify stationery, books, and gift sets. Stock is per variant/warehouse. Order lines snapshot the names, prices, quantities, and images at purchase. Tables, checkout, product pages, reviews, and analytics use the same persistent database. Money uses Decimal/Numeric and JSON strings. Generic management record values use typed JsonValue; authentication is validated with Zod, and commerce contracts are mirrored in TypeScript.

No inventory endpoint remains a 501 placeholder. Downloadable invoices and uploaded images are intentionally binary/document responses; ordinary API responses are Pydantic JSON. Email delivery and online payments have explicit configuration boundaries described in README.
