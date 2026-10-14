# Paper & Petal stationery commerce

The existing Next.js / FastAPI project now has a public stationery storefront, persistent PostgreSQL commerce data, customer accounts, COD checkout, and protected administration and inventory management. The original Argon2 authentication and hashed, revocable eight-hour sessions are preserved. Existing accounts remain customers until explicitly promoted; there are no default administrator credentials.

## Open the application

Run both processes in **two terminal tabs**. Keep your existing `.env` files; copy templates only when a file is missing.

Terminal 1:

```sh
cd /Users/riyanbhattarai/Desktop/ecommerce/backend
uv sync
uv run alembic upgrade head
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
cd /Users/riyanbhattarai/Desktop/ecommerce/frontend
npm ci
npm run dev
```

Open [the storefront](http://localhost:3000), [login](http://localhost:3000/login), or [registration](http://localhost:3000/register). The API documentation is at [FastAPI /docs](http://localhost:8000/docs).

Requirements: PostgreSQL 16 running locally, Python 3.13+, uv, and Node 22+. `backend/.env` holds the private `DATABASE_URL`; `frontend/.env` uses `API_INTERNAL_URL=http://localhost:8000` and `APP_ORIGIN=http://localhost:3000`. Use the exact configured origin in your browser, including hostname and port. Never copy secrets into browser variables. Database credentials in an explicitly supplied URL must be URL-encoded. Docker's separate `POSTGRES_*` variables are safely encoded by Settings.

If port 3000 or 8000 is already occupied by this project, use the existing terminal or stop that project process before starting another copy. A “Sign-in service is unavailable” message means the frontend cannot reach the backend; check the API process, `API_INTERNAL_URL`, migrations, and database connection first.

## Catalog and administrator access

The explicit development seed creates **54 sample products**, nine categories, five collections, SKU stock in Kathmandu Studio, a `WELCOME10` coupon, and editable store settings. It does not create reviews, revenue, customer purchases, or administrator accounts. It skips existing catalog records and preserves inventory edits.

```sh
cd backend
uv run python -m backend.seed --development
```

This seed has already been run on the local application database. Do not reset PostgreSQL. All commerce migrations extend the original `0001_auth.py` migration.

Register through the storefront, or use the trusted CLI to create an account. The CLI prompts privately for its password:

```sh
uv run python -m backend.cli your-email@example.com
uv run python -m backend.manage your-email@example.com --role admin
```

Then sign in and open `/admin` or `/inventory`. Use **your own registered email**, replacing the example. Promotion is an explicit trusted local operation; no existing account was automatically promoted. Public signup can only create customers. Login redirects by role and permissions.

For an inventory staff account:

```sh
uv run python -m backend.manage staff@example.com --role staff --permissions inventory.view,inventory.manage
```

Other permissions are `dashboard.view`, `catalog.manage`, `orders.manage`, `customers.manage`, `payments.view`, `marketing.manage`, `reviews.manage`, `settings.manage`, `notifications.view`, and `audit.view`. Admins have all permissions. Staff cannot promote customers or assign roles. Customers cannot access management APIs. Existing passwords, including six-character passwords, still work; new public registration/password changes require at least ten characters with a letter and a digit. Login failures are throttled after five invalid attempts for fifteen minutes.

## Implemented features

- Public editorial storefront with local fonts and optimized generated stationery photographs; search, category/collection/brand/price/color/availability/specification filters, sorting and pagination.
- Products, variants, SKU stock, image galleries, attributes, optional book properties, related products, and recommendations based on actual delivered purchases. Only approved customer reviews appear publicly.
- Persistent guest and account carts, guest merge, wishlist, saved addresses, customer profile/preferences, password change/reset, optional email verification, order history, invoices, cancellation, and return requests.
- Backend-authoritative coupons and shipping quotes, fifteen-minute stock holds, idempotent checkout, NPR Decimal price snapshots, COD orders, delivery tracking, and email notifications.
- Admin product/category/collection CRUD, image uploads, prices/variants, customers/roles, orders, payments, promotions/coupons, review moderation/reporting, returns, settings, newsletter subscriptions, audit logs, and actual analytics.
- Inventory warehouse CRUD, stock thresholds/adjustments/transfers, movement history, reservations, server expiration, low-stock alerts, partial replenishment receipts, and FIFO backorder allocation.
- Same-origin browser API proxies, HttpOnly cookies, mutation origin checks, role authorization, safe image validation, and sanitized errors.

Inventory management refreshes every thirty seconds and on mutations. Product pages read fresh API data. Stock uses PostgreSQL transactions, a consistent transaction advisory lock, and row locks; constraints prevent negative available stock. The shared inventory lock favors correctness and can become a throughput bottleneck at large scale.

Backorders allocate oldest first on receipts/positive adjustments and worker sweeps; partial allocations remain waiting until every order line is allocated. Preorders additionally wait for their configured release date; an unset release date keeps them waiting. Cancelled/returned allocations release once. Warehouse deactivation/deletion is restricted when its stock or pending operations would be affected. Reservation expiry runs every twenty seconds and at stock/checkout operations; the server is authoritative. Unpaid online orders expire after thirty minutes. COD is unpaid during fulfillment and recorded as collected when an authorized administrator marks delivery. Return receipt restores inventory; a COD refund records the administrator-confirmed refund. Online refund completion is deliberately blocked until an actual provider refund integration/confirmation workflow exists.

## Email and payment setup

With `SMTP_HOST` empty, notifications and password-reset links are written into private JSON files in `backend/.mailbox` by the backend worker. Files are mode 0600; the directory is not served publicly. Local messages have status `local`, rather than pretending that an email was delivered. Inspect these files privately for local reset/verification testing. Configure SMTP values from `backend/.env.example` for actual delivery; failed deliveries retry up to five times.

COD is available without external credentials. eSewa and Khalti use official signed initiation and server-side provider lookup; matching order reference, exact amount, completed status, and transaction identifiers are required. Without merchant keys, online methods remain unavailable and no successful payment is fabricated. Provider network responses are tested with mocks; no live merchant transaction has been performed.

Configure `PAYMENT_ENVIRONMENT=sandbox`, `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`, and/or `KHALTI_SECRET_KEY` using your approved merchant account. Set public HTTPS `APP_ORIGIN` and `PUBLIC_API_URL` for hosted callbacks. Official integration references: [eSewa ePay v2](https://developer.esewa.com.np/pages/Epay-V2), [Khalti ePayment](https://docs.khalti.com/khalti-epayment/). Enable production only with approved production credentials and end-to-end provider verification. No card information is stored.

## Docker

Docker is **not installed on this machine**, so container builds/startup have not been executed. Dockerfiles and Compose are provided, with PostgreSQL health checks, migrations, persistent database/media/mail volumes, and internal frontend-to-backend networking. The verified frontend production command uses Webpack.

On a Docker-enabled machine, create root `.env` from its template only if missing, fill the required `POSTGRES_*` values, and run:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose exec backend uv run --no-sync python -m backend.seed --development
docker compose exec backend uv run --no-sync python -m backend.cli your-email@example.com
docker compose exec backend uv run --no-sync python -m backend.manage your-email@example.com --role admin
```

Do not use `docker compose down -v` against valuable data. Hosted deployments require HTTPS, private secrets, tested backups, real merchant details/contact information, and finalized shipping/returns/privacy/terms policies. The current policy copy and generated sample catalog require business review before public launch. See [ASSETS.md](ASSETS.md).

## Validation

```sh
cd backend
uv run pytest -q
uv run ruff check src tests alembic ../scripts
uv run ruff format --check src tests alembic ../scripts
uv run mypy src/backend alembic
RUN_POSTGRES_TESTS=1 uv run pytest tests/test_postgres_concurrency.py -q
uv run alembic check
```

```sh
cd frontend
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build -- --webpack
```

SQLite service tests run without database credentials. PostgreSQL concurrency tests explicitly create UUID-named isolated schemas and drop only those schemas. Browser tests also use a separate schema, private random temporary admin credentials, and dedicated ports, preserving real accounts/orders:

```sh
# From backend/, prepare isolated QA data:
uv run python ../scripts/prepare_e2e.py
uv run python ../scripts/run_e2e_backend.py
# In another terminal, from frontend/:
NEXT_DIST_DIR=.next-qa API_INTERNAL_URL=http://127.0.0.1:8101 APP_ORIGIN=http://127.0.0.1:3100 npm run dev -- --port 3100
# In a third terminal, from frontend/:
npx playwright install chromium
npm run test:e2e
# Stop the two QA servers, then from backend/:
uv run python ../scripts/cleanup_e2e.py
```

An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects your own Chromium executable. Keep `/tmp/ecommerce-e2e-state.json` private; it contains temporary test credentials. Production builds can use `NEXT_DIST_DIR=.next-build` to avoid disturbing an active development server.

See [IMPLEMENTATION-PROGRESS.md](IMPLEMENTATION-PROGRESS.md) for actual validation results and external requirements, [API-CONTRACT.md](API-CONTRACT.md) for endpoints, [AUTH-CONTRACT.md](AUTH-CONTRACT.md) for sessions, and [STRUCTURE.md](STRUCTURE.md) for architecture.

## Latest storefront layout

The homepage now prioritizes shopping: visible search, a compact branded banner, and twelve available PostgreSQL catalog products with six desktop/two mobile columns. Product images, NPR prices, category links, cart counts and authentication continue using the existing API and session system. Homepage products can be browsed without login; customers cannot enter inventory administration.

The latest browser acceptance suite was verified against a production build. To run that same mode from `frontend/`, after stopping another frontend using port 3000:

```sh
NEXT_DIST_DIR=.next-build npm run build -- --webpack
NEXT_DIST_DIR=.next-build npm run start -- --port 3000
```

Keep FastAPI running in another terminal. For production-mode isolated browser QA, build with `NEXT_DIST_DIR=.next-build` and replace the QA dev command above with:

```sh
NEXT_DIST_DIR=.next-build API_INTERNAL_URL=http://127.0.0.1:8101 APP_ORIGIN=http://127.0.0.1:3100 npm run start -- --port 3100
```

The agent environment's development HMR handshake stalled; the final six browser tests passed in production mode. See the progress document for accurate latest results and screenshots.
