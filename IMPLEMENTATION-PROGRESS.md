# Stationery commerce implementation progress

Updated 2026-10-13. The comprehensive continuation prompt has been implemented in the existing Next.js / FastAPI application. Required external launch configuration and the online-refund limitation are listed explicitly below.

## Preservation

- Original authentication migration, password hashes, users, hashed sessions, inventory URLs, and feature architecture retained.
- PostgreSQL was extended with additive migrations; no database reset or public-schema deletion.
- Existing accounts default to customer; none was automatically promoted. Trusted CLI promotion is explicit.
- Backend/frontend feature branches are `feature/stationery-commerce`; existing uncommitted work remains. No commits or deployments were made.
- Source backup created before implementation: `/tmp/ecommerce-source-before-commerce-20261013020450.tar.gz`, excluding secrets, Git metadata, dependencies, and generated builds.

## Implemented milestones

- [x] Baseline inspection/validation and source preservation (historical baseline: 16 backend, 23 frontend tests).
- [x] API contract extensions and additive migrations `5855221e5d71`, `ec9f009476ac` applied after original `0001_auth`.
- [x] Customer registration, account settings, password recovery/change, verification, roles, permissions, and database login throttling.
- [x] Categories/subcategories, collections, products, brands, SKU variants, attributes, images, and explicit idempotent 54-product development seed.
- [x] Warehouse CRUD/details, stock movements/adjustments/transfers, reservations, server expiration, alerts, partial replenishment, FIFO backorder/preorder allocation.
- [x] Persistent guest/customer carts and merge, wishlist, saved addresses, coupons, authoritative shipping/checkout quotes, and idempotent COD orders.
- [x] Order lifecycle/tracking/shipments, downloadable HTML invoices, cancellation, return requests, COD refunds, notification queue, local mail/SMTP adapter.
- [x] eSewa/Khalti signed initiation and server verification adapters; missing credentials keep methods unavailable. Online refunds remain blocked pending actual provider confirmation integration.
- [x] Responsive public storefront, shop/search/filters/sorting/pagination, PDP, cart, checkout, account pages, and branded auth/recovery screens.
- [x] Role-protected admin and inventory dashboards connected to persistent data, CRUD dialogs, uploads, and useful operational actions.
- [x] Coupons/promotions, approved reviews/moderation/reporting, real co-purchase recommendations, newsletter consent/preferences, actual analytics, audit logs, settings, SEO and local fonts/assets.
- [x] Backend/frontend regressions, PostgreSQL concurrency, desktop/mobile browser tests, visual inspection, production build/runtime checks.
- [x] README, architecture/auth/API contracts, environment templates, asset provenance, Docker configuration review, and QA setup/cleanup scripts.

## Final verified results

| Check | Result |
| --- | --- |
| Full backend pytest with RUN_POSTGRES_TESTS=1 | **56 passed** |
| Included PostgreSQL concurrency tests | **6 passed** in UUID-named isolated schemas |
| Frontend Vitest | **35 passed**, 8 files |
| Playwright Chromium | **4 passed**, desktop and mobile |
| Ruff lint and formatting | Passed, source/tests/Alembic/QA scripts |
| MyPy strict | Passed, source/Alembic/QA scripts |
| ESLint / TypeScript / Prettier | Passed |
| Frontend production Webpack build | Passed, including warehouse detail route |
| Alembic model/migration consistency | Passed; no new upgrade operations detected |
| Production preview HTTP | 200 for /, /shop, /login, /products/pastel-gel-pen-set, /sitemap.xml |
| Normal local application HTTP | 200 for storefront/login/catalog; catalog has 54 records |
| Docker build/start | **Not run: Docker is not installed** |
| Live merchant payment / SMTP delivery | **Not run: external credentials are absent** |

Browser tests proved real admin product creation and image upload, SKU stock creation, storefront display, guest add-to-cart, registration/cart merge, coupon quote/checkout, COD order persistence, customer order detail, correct stock reduction, admin packed/shipped/delivered workflow and COD collection. They also proved wishlist persistence, verified-purchase review submission, hiding unapproved reviews, admin moderation, public approved review display, and review reporting.

Additional browser coverage proved warehouse creation/details, stock transfer, reserved/available quantities, hold cancellation, and partial/completed replenishment receipts on desktop and mobile. PostgreSQL tests proved concurrent holds never oversell, cancellation releases once, decrements never go negative, simultaneous order cancellations restore once, stale admin requests cannot cancel delivered orders, and identical concurrent checkout creates one order/decrement.

Failures found during implementation were corrected and rerun: unauthorized customers initially inherited inventory access; blank decimal filters; guest cart initialization races; tracking-only updates; preorder release gating; direct receipt allocation; duplicate variant validation; category cycles; unsafe promotional links; customer profile input validation; stale order state; production prerender dependency; and mobile header utility ordering. Tests were retained and strict checking remains enabled.

## Operational decisions

- Session architecture remains Argon2id + hashed opaque tokens with default eight-hour expiry. Existing six-character passwords still log in; stronger policy applies to new registration/change/reset.
- Public signup cannot assign a role. Inventory and every admin resource enforce backend permissions independently of frontend guards.
- Monetary values are Decimal/Numeric with JSON strings in NPR. Quotes do not consume coupons; successful order creation consumes once.
- Fifteen-minute stock holds expire server-side. The worker runs every twenty seconds; stock/checkout operations also sweep expiry. Unpaid online orders expire after thirty minutes.
- Inventory serializes cross-SKU operations with a PostgreSQL transaction advisory lock followed by row locks. This favors correctness; high-volume deployments may need finer locking after load tests.
- Backorders allocate FIFO, with partial allocation tracked until complete. Preorders additionally wait for their release date; no date means waiting. Returns/cancellations restore allocations once.
- COD remains unpaid until an authorized delivery update confirms collection. COD refund records require an explicit administration action. No online payment/refund success is invented.
- Reviews/ratings/bestsellers/revenue and frequently bought together derive from actual database data. Development seed has no fabricated reviews, sales, customers, or admin.

## External requirements and launch work

- [ ] Install Docker on the target machine and actually build/start Compose. Configuration includes health checks, migrations, persistent PostgreSQL/media/mail volumes, and correctly encoded separate database credentials, but container execution remains unverified.
- [ ] Provide official eSewa/Khalti merchant sandbox/production keys and validate real provider callbacks/transactions. Automated tests mock official lookup responses and reject incomplete/mismatched payments.
- [ ] Add a provider-backed online refund/confirmation workflow before enabling online refunds. Current management deliberately rejects marking an online refund complete without this capability.
- [ ] Configure SMTP and verify actual delivery. Local testing writes private notification JSON files; these have status local and are not real outbound emails.
- [ ] Replace generated sample catalog photos with accurate merchant merchandise, finalize operator/contact details and commercial/legal/shipping/returns copy, configure public HTTPS origins, and test production backups/hosting before public launch.

These are visible limitations rather than simulated integrations. See README and ASSETS.md for configuration and asset provenance.

## Current local state and safe continuation

Normal frontend remains on `http://localhost:3000`; the final API is running on `http://127.0.0.1:8000`. Existing account passwords and PostgreSQL public records are preserved. Register a customer or explicitly promote your chosen existing email with `python -m backend.manage EMAIL --role admin` to access management.

Temporary QA servers on 3100/8101 and the production preview on 3200 were stopped. The isolated browser QA schema and private temporary admin credential state were removed using the validated cleanup script. Concurrency schemas clean themselves. Ignored Playwright reports/traces and `/tmp/paper-petal-*` screenshots are development artifacts; mobile and desktop visuals were inspected. Do not reuse temporary test credentials as application credentials.

Read README, API-CONTRACT, AUTH-CONTRACT, STRUCTURE, and this document before further changes. Keep `.env` private, preserve the existing database/migrations, and use explicit test schema setup for future browser runs.

## Product-focused storefront update — 2026-10-13

Implemented the user's two-reference layout request in the existing frontend. The public `/` now opens with prominent search, a compact stationery promotion, and twelve available database products before secondary editorial content. The grid has six desktop columns and two mobile columns. Cream, existing Fraunces/DM Sans fonts, original Paper & Petal logo/photography, and forest-green shopping accents are preserved. No Daraz assets or branding were copied.

Reusable AnnouncementBar, SearchBar, HeroBanner, ProductGrid, and StoreLoading components complement the existing StoreHeader/ProductCard/ProductActions/StoreFooter. Header navigation links directly to shop, login, account, and cart; categories scroll locally without overflowing the document. Product cards show real NPR prices, images, stock-backed cart actions, wishlist controls, and detail links. Home requests use existing FastAPI catalog contracts with availability and twelve-item pagination; no backend business logic, models, migrations, or public PostgreSQL records were changed.

The original login implementation is retained with an added HTML POST fallback so credentials cannot enter URL query parameters before client hydration. Customer accounts remain blocked from inventory; browser tests assert the protected redirect as well as guest login routing. Root/store loading skeletons and friendly catalog/error/empty states are connected.

Latest validation: **39 frontend tests passed**, **50 backend tests passed** with six opt-in tests skipped in the default run; the **six PostgreSQL concurrency tests passed separately**. Ruff/MyPy, ESLint/TypeScript/Prettier, Alembic check and production Webpack build passed. **Six desktop/mobile Playwright tests passed against the production frontend**, covering the new public storefront plus preserved login, checkout/COD, moderation, and inventory workflows. Tests assert twelve backend products, loaded images, NPR prices in the first viewport, no document overflow, working search/categories/detail/cart/count, and account/inventory guards. Desktop and mobile screenshots were inspected at `/tmp/paper-petal-shopping-desktop.png` and `/tmp/paper-petal-shopping-mobile.png`.

Development-mode browser attempts in this tool environment stalled during client hydration with failed HMR WebSocket handshakes; switching bundlers did not resolve that environment failure. Final interactive verification used the production build, where all six workflows passed. Development HMR is not claimed verified in this environment. The application is left running from that verified build on localhost:3000 with the normal API on 127.0.0.1:8000. Stop that preview before starting a development server on the same port.

QA used a separate UUID-named schema and temporary credentials. QA servers/schema/state are cleaned up after validation; normal accounts and inventory remain intact. Existing external payment/SMTP/Docker launch requirements above are unchanged.
