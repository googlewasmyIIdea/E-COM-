# Stationery API contract extensions

The user's master continuation instruction authorizes the following extensions to the existing versioned REST API. Existing auth routes and inventory URLs remain. All JSON controllers use Pydantic models. UUID identifiers; ISO UTC timestamps; decimal money strings; NPR currency. Errors use `{ "detail": "..." }` with 400/401/403/404/409/422 as appropriate.

## Authorization

Public catalog, categories, collections, newsletter, and approved reviews are readable without login. Registration always creates a customer. Staff requires named permissions; admin has all permissions. Customers may only access their own cart, addresses, wishlist, orders, and reviews. Existing accounts become customers until explicitly promoted via the trusted CLI.

## Authentication extensions

- POST `/auth/register`: `{email,password,name}` -> existing LoginResponse and cookie session. New password >=10 characters with letters and digits; existing login passwords remain accepted.
- POST `/auth/password/forgot`: `{email}` -> generic accepted message regardless of account existence; tokens sent through email adapter.
- POST `/auth/password/reset`: `{token,password}` -> message; consumes token, changes hash, revokes old sessions.
- POST `/auth/password/change`: authenticated `{current_password,password}` -> message and session revocation.
- POST `/auth/verification/request`, POST `/auth/verification/confirm`: optional email verification.
- GET/PATCH `/account/profile`: name, phone, preferences. No role changes through account APIs.
- GET/POST `/account/addresses`; PATCH/DELETE `/account/addresses/{id}`. GET `/account/wishlist`; POST/DELETE `/account/wishlist/{product_id}`.

## Catalog

- GET `/catalog/products`: q, category, collection, brand, min_price, max_price, color, availability, attribute (key:value), sort, page, page_size -> `{items,total,page,page_size}`.
- GET `/catalog/products/{slug}` -> full product, images, attributes, variants, stock, approved reviews.
- GET `/catalog/categories`, `/catalog/collections`, `/catalog/recommendations/{slug}`, `/catalog/bought-together/{slug}` (actual delivered/paid orders only).
- POST `/catalog/products/{id}/reviews`; POST `/catalog/reviews/{id}/report`.
- POST `/newsletter`: `{email,consent:true}`.

## Inventory

Existing collection GETs return arrays compatible with original schemas, with additional stationery fields. Book-only title/format aliases are optional compatibility fields.

- GET `/inventory/variants`: protected full SKU lookup, including inactive products for inventory history.
- GET/POST `/inventory/warehouses`; GET/PATCH/DELETE `/inventory/warehouses/{id}`.
- GET/POST `/inventory/stock`; PATCH `/inventory/stock/{id}` thresholds; POST `/inventory/stock/{id}/adjust` `{delta,reason}`; POST `/inventory/transfers` `{stock_id,destination_warehouse_id,quantity,reason}`; GET `/inventory/movements`.
- GET/POST `/inventory/reservations`; POST `/inventory/reservations/{id}/cancel`; POST `/inventory/reservations/expire`. Holds expire after 15 minutes by default. Ownership and stock are validated.
- GET `/inventory/alerts`; PATCH `/inventory/alerts/{id}` `{status}`.
- GET/POST `/inventory/replenishments`; POST `/{id}/receive` `{quantity}`; POST `/{id}/cancel`.

## Cart and checkout

- GET `/cart`; POST `/cart/items` `{variant_id,quantity}`; PATCH/DELETE `/cart/items/{id}`; POST `/cart/merge`.
- Guests use a random HttpOnly guest-cart secret, stored hashed in the database. Authenticated users use their own persistent cart.
- POST `/checkout/quote`: authoritative coupon/shipping totals without consuming coupon usage.
- POST `/checkout/reserve` -> holds checkout stock; POST `/checkout/orders` `{address,delivery,payment_method,coupon_code,idempotency_key}` -> order calculated authoritatively from database prices. COD is functional without provider credentials.
- GET `/orders`, GET `/orders/{id}`, POST `/orders/{id}/cancel`, GET `/orders/{id}/invoice`.
- GET `/payments/options`: COD plus configured provider availability.
- POST `/payments/{order_id}/initiate`; POST `/payments/{order_id}/verify`. Provider callbacks require actual backend verification, matching amount/currency/order and idempotent completion.

## Administration

- GET `/admin/overview`, `/admin/analytics`, `/admin/audit` -> actual database aggregates.
- GET `/admin/{resource}` and GET `/admin/{resource}/{id}` expose authorized records for products, variants, categories, collections, coupons, promotions, reviews, returns, settings, customers, orders, payments, newsletter, notifications, and audit logs.
- POST supports products, variants (including product_id), categories, collections, coupons, promotions, and settings. Other resources are created through their dedicated customer/order/payment workflows.
- PATCH supports catalog/marketing/settings records, review moderation, returns, validated order transitions, and administrator-only customer changes. Payments, notifications, newsletter, and audit logs are read-only.
- DELETE deactivates catalog/taxonomy/marketing records or rejects deletion of referenced/protected records. Financial/order history cannot be deleted through generic CRUD.
- GET `/store/settings`, `/store/promotions`, `/store/reviews`: public configuration, currently eligible promotions, and approved reviews.
- POST `/orders/{id}/return`: customer return request for a delivered order.
- POST `/admin/uploads`: validated image upload -> public asset URL.
- All changes are audited. Products/categories with referenced sales/stock are deactivated or deletion is rejected, not destructively cascaded.

## Policies

Orders snapshot descriptions and prices. COD remains unpaid until delivery collection. Invalid transitions are rejected. Cancelled allocations restore stock exactly once. Preorders/backorders allocate FIFO by order creation time after receipts; order status moves from awaiting stock only once its complete demand is covered. Payment success is never simulated. Reviews require moderation before display; verified-purchase flags derive from actual orders.
