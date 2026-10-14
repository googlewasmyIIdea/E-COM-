from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.commerce import Reservation


async def catalog_item(
    api: AsyncClient, admin: dict[str, str], quantity: int = 10
) -> dict[str, str]:
    category = await api.post(
        "/api/v1/admin/categories",
        headers=admin,
        json={"name": "Notebooks", "slug": "notebooks"},
    )
    assert category.status_code == 201
    product = await api.post(
        "/api/v1/admin/products",
        headers=admin,
        json={
            "name": "Lavender Journal",
            "slug": "lavender-journal",
            "description": "A dot grid journal",
            "category_id": category.json()["id"],
            "brand": "Paper & Petal",
            "images": ["/images/journal.webp"],
            "variants": [
                {
                    "sku": "JOURNAL-LAV",
                    "name": "Lavender",
                    "price": "650.00",
                    "attributes": {"color": "Lavender"},
                }
            ],
        },
    )
    assert product.status_code == 201, product.text
    variant = product.json()["variants"][0]
    warehouse = await api.post(
        "/api/v1/inventory/warehouses",
        headers=admin,
        json={"name": "Kathmandu", "code": "KTM", "location": "Kathmandu"},
    )
    assert warehouse.status_code == 201
    stock = await api.post(
        "/api/v1/inventory/stock",
        headers=admin,
        json={
            "warehouse_id": warehouse.json()["id"],
            "variant_id": variant["id"],
            "quantity_on_hand": quantity,
            "reorder_point": 3,
        },
    )
    assert stock.status_code == 201, stock.text
    return {
        "product_id": product.json()["id"],
        "variant_id": variant["id"],
        "stock_id": stock.json()["id"],
        "warehouse_id": warehouse.json()["id"],
    }


@pytest.mark.asyncio
async def test_registration_never_grants_admin(api: AsyncClient) -> None:
    invalid = await api.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "name": "New",
            "password": "BetterPass123",
            "role": "admin",
        },
    )
    assert invalid.status_code == 422
    response = await api.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "name": "New", "password": "BetterPass123"},
    )
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "customer"
    headers = {"Authorization": "Bearer " + response.json()["session_token"]}
    assert (
        await api.get("/api/v1/inventory/stock", headers=headers)
    ).status_code == 403
    assert (await api.get("/api/v1/admin/overview", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_public_catalog_and_filtering(
    api: AsyncClient, admin: dict[str, str]
) -> None:
    await catalog_item(api, admin)
    response = await api.get(
        "/api/v1/catalog/products?q=journal&category=notebooks&min_price=500&max_price=700"
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["variants"][0]["price"] == "650.00"
    assert (await api.get("/api/v1/catalog/products?q=does-not-exist")).json()[
        "total"
    ] == 0
    detail = await api.get("/api/v1/catalog/products/lavender-journal")
    assert detail.json()["available_stock"] == 10


@pytest.mark.asyncio
async def test_customer_cannot_modify_catalog(
    api: AsyncClient, customer: dict[str, str]
) -> None:
    response = await api.post(
        "/api/v1/admin/products",
        headers=customer,
        json={"name": "Unauthorized", "slug": "unauthorized", "variants": []},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_stock_adjustments_and_alerts(
    api: AsyncClient, admin: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin, quantity=5)
    response = await api.post(
        f"/api/v1/inventory/stock/{ids['stock_id']}/adjust",
        headers=admin,
        json={"delta": -3, "reason": "Damaged items"},
    )
    assert response.status_code == 200
    assert response.json()["available_stock"] == 2
    assert (await api.get("/api/v1/inventory/alerts", headers=admin)).json()
    invalid = await api.post(
        f"/api/v1/inventory/stock/{ids['stock_id']}/adjust",
        headers=admin,
        json={"delta": -10, "reason": "Invalid"},
    )
    assert invalid.status_code == 409
    movements = (await api.get("/api/v1/inventory/movements", headers=admin)).json()
    assert any(item["reason"] == "Damaged items" for item in movements)


@pytest.mark.asyncio
async def test_reserve_cancel_and_expire_idempotently(
    api: AsyncClient, admin: dict[str, str], commerce_db: AsyncSession
) -> None:
    ids = await catalog_item(api, admin, quantity=2)
    response = await api.post(
        "/api/v1/inventory/reservations",
        headers=admin,
        json={"stock_id": ids["stock_id"], "quantity": 2},
    )
    assert response.status_code == 201
    reservation_id = response.json()["id"]
    assert (
        await api.post(
            "/api/v1/inventory/reservations",
            headers=admin,
            json={"stock_id": ids["stock_id"], "quantity": 1},
        )
    ).status_code == 409
    for _ in range(2):
        assert (
            await api.post(
                f"/api/v1/inventory/reservations/{reservation_id}/cancel", headers=admin
            )
        ).status_code == 200
    response = await api.post(
        "/api/v1/inventory/reservations",
        headers=admin,
        json={"stock_id": ids["stock_id"], "quantity": 1},
    )
    stored = await commerce_db.get(Reservation, UUID(response.json()["id"]))
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await commerce_db.commit()
    for _ in range(2):
        assert (
            await api.post("/api/v1/inventory/reservations/expire", headers=admin)
        ).status_code == 200
    stock = (await api.get("/api/v1/inventory/stock", headers=admin)).json()[0]
    assert stock["quantity_reserved"] == 0
    assert stock["quantity_on_hand"] == 2


@pytest.mark.asyncio
async def test_replenishment_partial_and_complete(
    api: AsyncClient, admin: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin, quantity=0)
    response = await api.post(
        "/api/v1/inventory/replenishments",
        headers=admin,
        json={"stock_id": ids["stock_id"], "quantity": 5, "kind": "backorder"},
    )
    assert response.status_code == 201
    url = f"/api/v1/inventory/replenishments/{response.json()['id']}/receive"
    partial = await api.post(url, headers=admin, json={"quantity": 2})
    assert partial.json()["status"] == "partial"
    complete = await api.post(url, headers=admin, json={"quantity": 3})
    assert complete.json()["status"] == "completed"
    assert (await api.post(url, headers=admin, json={"quantity": 1})).status_code == 409
    assert (await api.get("/api/v1/inventory/stock", headers=admin)).json()[0][
        "quantity_on_hand"
    ] == 5


@pytest.mark.asyncio
async def test_checkout_cod_totals_inventory_and_idempotency(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin, quantity=4)
    assert (
        await api.post(
            "/api/v1/cart/items",
            headers=customer,
            json={"variant_id": ids["variant_id"], "quantity": 2},
        )
    ).status_code == 200
    body = {
        "address": {
            "name": "Customer",
            "phone": "9800000000",
            "line1": "Main street",
            "city": "Kathmandu",
            "country": "NP",
        },
        "delivery": "standard",
        "payment_method": "cod",
        "idempotency_key": "checkout-test-key-123",
    }
    first = await api.post("/api/v1/checkout/orders", headers=customer, json=body)
    assert first.status_code == 201, first.text
    order = first.json()
    assert order["subtotal"] == "1300.00"
    assert order["payment_status"] == "unpaid"
    second = await api.post("/api/v1/checkout/orders", headers=customer, json=body)
    assert second.status_code == 201
    assert second.json()["id"] == order["id"]
    assert len((await api.get("/api/v1/orders", headers=customer)).json()) == 1
    stock = (await api.get("/api/v1/inventory/stock", headers=admin)).json()[0]
    assert stock["quantity_on_hand"] == 2
    assert (
        await api.get(f"/api/v1/orders/{order['id']}/invoice", headers=customer)
    ).status_code == 200
    for _ in range(2):
        assert (
            await api.post(f"/api/v1/orders/{order['id']}/cancel", headers=customer)
        ).status_code == 200
    assert (await api.get("/api/v1/inventory/stock", headers=admin)).json()[0][
        "quantity_on_hand"
    ] == 4


@pytest.mark.asyncio
async def test_order_ownership_and_status_validation(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin)
    await api.post(
        "/api/v1/cart/items",
        headers=customer,
        json={"variant_id": ids["variant_id"], "quantity": 1},
    )
    body = {
        "address": {
            "name": "Customer",
            "phone": "9800000000",
            "line1": "Main street",
            "city": "Kathmandu",
            "country": "NP",
        },
        "delivery": "standard",
        "payment_method": "cod",
        "idempotency_key": "order-status-key-123",
    }
    order = (
        await api.post("/api/v1/checkout/orders", headers=customer, json=body)
    ).json()
    invalid = await api.patch(
        f"/api/v1/admin/orders/{order['id']}",
        headers=admin,
        json={"status": "delivered"},
    )
    assert invalid.status_code == 409
    for status in ["packed", "shipped", "delivered"]:
        response = await api.patch(
            f"/api/v1/admin/orders/{order['id']}",
            headers=admin,
            json={"status": status},
        )
        assert response.status_code == 200
    assert response.json()["payment_status"] == "paid"


@pytest.mark.asyncio
async def test_coupon_review_and_newsletter(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin)
    assert (
        await api.post(
            "/api/v1/admin/coupons",
            headers=admin,
            json={
                "code": "WELCOME10",
                "kind": "percentage",
                "value": "10",
                "max_uses": 1,
            },
        )
    ).status_code == 201
    review = await api.post(
        f"/api/v1/catalog/products/{ids['product_id']}/reviews",
        headers=customer,
        json={"rating": 5, "title": "Lovely", "body": "Beautiful paper and binding"},
    )
    assert review.status_code == 201
    assert (await api.get("/api/v1/catalog/products/lavender-journal")).json()[
        "reviews"
    ] == []
    assert (
        await api.patch(
            f"/api/v1/admin/reviews/{review.json()['id']}",
            headers=admin,
            json={"status": "approved"},
        )
    ).status_code == 200
    assert (
        len(
            (await api.get("/api/v1/catalog/products/lavender-journal")).json()[
                "reviews"
            ]
        )
        == 1
    )
    assert (
        await api.post(
            "/api/v1/newsletter",
            json={"email": "subscriber@example.com", "consent": False},
        )
    ).status_code == 422
    for _ in range(2):
        assert (
            await api.post(
                "/api/v1/newsletter",
                json={"email": "subscriber@example.com", "consent": True},
            )
        ).status_code == 200


@pytest.mark.asyncio
async def test_checkout_quote_applies_coupon_without_consuming_it(
    api: AsyncClient,
    admin: dict[str, str],
    customer: dict[str, str],
) -> None:
    ids = await catalog_item(api, admin)
    await api.post(
        "/api/v1/cart/items",
        headers=customer,
        json={"variant_id": ids["variant_id"], "quantity": 2},
    )
    await api.post(
        "/api/v1/admin/coupons",
        headers=admin,
        json={"code": "TENOFF", "kind": "percentage", "value": "10", "max_uses": 1},
    )
    for _ in range(2):
        quote = await api.post(
            "/api/v1/checkout/quote",
            headers=customer,
            json={"delivery": "standard", "coupon_code": "TENOFF"},
        )
        assert quote.status_code == 200
        assert quote.json() == {
            "subtotal": "1300.00",
            "shipping": "100.00",
            "discount": "130.00",
            "total": "1270.00",
            "coupon_code": "TENOFF",
        }
    coupons = (await api.get("/api/v1/admin/coupons", headers=admin)).json()
    assert coupons["items"][0]["data"]["uses"] == 0


@pytest.mark.asyncio
async def test_guest_cart_merge_preserves_items(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin)
    guest = {"X-Guest-Cart": "a-cryptographically-random-guest-key"}
    assert (
        await api.post(
            "/api/v1/cart/items",
            headers=guest,
            json={"variant_id": ids["variant_id"], "quantity": 2},
        )
    ).status_code == 200
    merge = await api.post("/api/v1/cart/merge", headers={**customer, **guest})
    assert merge.status_code == 200
    assert merge.json()["count"] == 2
    assert (await api.get("/api/v1/cart", headers=customer)).json()["count"] == 2


@pytest.mark.asyncio
async def test_admin_can_update_tracking_without_changing_status(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin)
    await api.post(
        "/api/v1/cart/items",
        headers=customer,
        json={"variant_id": ids["variant_id"], "quantity": 1},
    )
    payload = {
        "address": {
            "name": "Customer",
            "phone": "9800000000",
            "line1": "Main street",
            "city": "Kathmandu",
            "country": "NP",
        },
        "delivery": "standard",
        "payment_method": "cod",
        "idempotency_key": "tracking-update-key-123",
    }
    order = (
        await api.post("/api/v1/checkout/orders", headers=customer, json=payload)
    ).json()
    result = await api.patch(
        f"/api/v1/admin/orders/{order['id']}",
        headers=admin,
        json={"tracking_number": "NEPAL-123", "notes": "Ready for pickup"},
    )
    assert result.status_code == 200
    assert result.json()["tracking_number"] == "NEPAL-123"
    assert result.json()["notes"] == "Ready for pickup"


@pytest.mark.asyncio
async def test_preorder_waits_for_release_date(
    api: AsyncClient,
    admin: dict[str, str],
    customer: dict[str, str],
    commerce_db: AsyncSession,
) -> None:
    from backend.services.orders import OrderService

    ids = await catalog_item(api, admin)
    release = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    assert (
        await api.patch(
            f"/api/v1/admin/products/{ids['product_id']}",
            headers=admin,
            json={"preorder": True, "release_date": release},
        )
    ).status_code == 200
    await api.post(
        "/api/v1/cart/items",
        headers=customer,
        json={"variant_id": ids["variant_id"], "quantity": 1},
    )
    payload = {
        "address": {
            "name": "Customer",
            "phone": "9800000000",
            "line1": "Main street",
            "city": "Kathmandu",
            "country": "NP",
        },
        "payment_method": "cod",
        "idempotency_key": "preorder-release-key-123",
    }
    response = await api.post("/api/v1/checkout/orders", headers=customer, json=payload)
    assert response.status_code == 201
    order_id = UUID(response.json()["id"])
    assert response.json()["status"] == "awaiting_release"
    blocked = await api.patch(
        f"/api/v1/admin/orders/{order_id}", headers=admin, json={"status": "processing"}
    )
    assert blocked.status_code == 409
    await OrderService(commerce_db).allocate_backorders()
    await commerce_db.commit()
    assert (await api.get(f"/api/v1/orders/{order_id}", headers=customer)).json()[
        "status"
    ] == "awaiting_release"
    await api.patch(
        f"/api/v1/admin/products/{ids['product_id']}",
        headers=admin,
        json={"release_date": (datetime.now(UTC) - timedelta(seconds=1)).isoformat()},
    )
    await OrderService(commerce_db).allocate_backorders()
    await commerce_db.commit()
    assert (await api.get(f"/api/v1/orders/{order_id}", headers=customer)).json()[
        "status"
    ] == "processing"


@pytest.mark.asyncio
async def test_backorder_partial_receipts_allocate_fifo(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin, quantity=0)
    await api.patch(
        f"/api/v1/admin/products/{ids['product_id']}",
        headers=admin,
        json={"allow_backorder": True},
    )
    registered = await api.post(
        "/api/v1/auth/register",
        json={
            "email": "second@example.com",
            "name": "Second",
            "password": "SecondPassword123",
        },
    )
    second = {"Authorization": "Bearer " + registered.json()["session_token"]}
    orders = []
    for index, (actor, quantity) in enumerate([(customer, 2), (second, 1)]):
        await api.post(
            "/api/v1/cart/items",
            headers=actor,
            json={"variant_id": ids["variant_id"], "quantity": quantity},
        )
        response = await api.post(
            "/api/v1/checkout/orders",
            headers=actor,
            json={
                "address": {
                    "name": "Customer",
                    "phone": "9800000000",
                    "line1": "Main street",
                    "city": "Kathmandu",
                    "country": "NP",
                },
                "payment_method": "cod",
                "idempotency_key": f"fifo-order-key-123-{index}",
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == "awaiting_stock"
        orders.append(response.json()["id"])
    replen = (
        await api.post(
            "/api/v1/inventory/replenishments",
            headers=admin,
            json={"stock_id": ids["stock_id"], "quantity": 3},
        )
    ).json()
    assert (
        await api.post(
            f"/api/v1/inventory/replenishments/{replen['id']}/receive",
            headers=admin,
            json={"quantity": 1},
        )
    ).status_code == 200
    first = (await api.get(f"/api/v1/orders/{orders[0]}", headers=customer)).json()
    next_order = (await api.get(f"/api/v1/orders/{orders[1]}", headers=second)).json()
    assert first["items"][0]["allocated"] == 1
    assert next_order["items"][0]["allocated"] == 0
    assert (
        await api.post(
            f"/api/v1/inventory/replenishments/{replen['id']}/receive",
            headers=admin,
            json={"quantity": 2},
        )
    ).status_code == 200
    assert (await api.get(f"/api/v1/orders/{orders[0]}", headers=customer)).json()[
        "status"
    ] == "processing"
    assert (await api.get(f"/api/v1/orders/{orders[1]}", headers=second)).json()[
        "status"
    ] == "processing"


@pytest.mark.asyncio
async def test_image_upload_rejects_svg_and_unauthorized_customer(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    file = {
        "file": ("image.svg", b"<svg><script>alert(1)</script></svg>", "image/svg+xml")
    }
    assert (
        await api.post("/api/v1/admin/uploads", headers=customer, files=file)
    ).status_code == 403
    assert (
        await api.post("/api/v1/admin/uploads", headers=admin, files=file)
    ).status_code == 400


@pytest.mark.asyncio
async def test_direct_stock_receipt_allocates_waiting_backorder(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin, quantity=0)
    await api.patch(
        f"/api/v1/admin/products/{ids['product_id']}",
        headers=admin,
        json={"allow_backorder": True},
    )
    await api.post(
        "/api/v1/cart/items",
        headers=customer,
        json={"variant_id": ids["variant_id"], "quantity": 1},
    )
    order = (
        await api.post(
            "/api/v1/checkout/orders",
            headers=customer,
            json={
                "address": {
                    "name": "Customer",
                    "phone": "9800000000",
                    "line1": "Main street",
                    "city": "Kathmandu",
                    "country": "NP",
                },
                "payment_method": "cod",
                "idempotency_key": "direct-receipt-backorder-123",
            },
        )
    ).json()
    assert order["status"] == "awaiting_stock"
    response = await api.post(
        f"/api/v1/inventory/stock/{ids['stock_id']}/adjust",
        headers=admin,
        json={"delta": 1, "reason": "Received new shipment"},
    )
    assert response.status_code == 200
    assert (await api.get(f"/api/v1/orders/{order['id']}", headers=customer)).json()[
        "status"
    ] == "processing"


@pytest.mark.asyncio
async def test_category_parent_cycles_are_rejected(
    api: AsyncClient, admin: dict[str, str]
) -> None:
    root = (
        await api.post(
            "/api/v1/admin/categories",
            headers=admin,
            json={"name": "Paper", "slug": "paper"},
        )
    ).json()
    child = (
        await api.post(
            "/api/v1/admin/categories",
            headers=admin,
            json={"name": "Cards", "slug": "cards", "parent_id": root["id"]},
        )
    ).json()
    result = await api.patch(
        f"/api/v1/admin/categories/{root['id']}",
        headers=admin,
        json={"parent_id": child["id"]},
    )
    assert result.status_code == 409


@pytest.mark.asyncio
async def test_duplicate_variants_and_invalid_promotional_links_are_rejected(
    api: AsyncClient, admin: dict[str, str]
) -> None:
    body = {
        "name": "Bad product",
        "slug": "bad-product",
        "variants": [
            {"sku": "DUP", "name": "One", "price": "10"},
            {"sku": "DUP", "name": "Two", "price": "20"},
        ],
    }
    assert (
        await api.post("/api/v1/admin/products", headers=admin, json=body)
    ).status_code == 422
    assert (
        await api.post(
            "/api/v1/admin/promotions",
            headers=admin,
            json={
                "name": "Bad link",
                "headline": "Unsafe",
                "link": "javascript:alert(1)",
            },
        )
    ).status_code == 422


@pytest.mark.asyncio
async def test_frequently_bought_together_requires_real_completed_orders(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    first = await catalog_item(api, admin)
    assert (
        await api.get("/api/v1/catalog/bought-together/lavender-journal")
    ).json() == []
    second = (
        await api.post(
            "/api/v1/admin/products",
            headers=admin,
            json={
                "name": "Companion pen",
                "slug": "companion-pen",
                "variants": [{"sku": "PEN-PAIR", "name": "Black", "price": "80.00"}],
            },
        )
    ).json()
    variant = second["variants"][0]["id"]
    await api.post(
        "/api/v1/inventory/stock",
        headers=admin,
        json={
            "warehouse_id": first["warehouse_id"],
            "variant_id": variant,
            "quantity_on_hand": 5,
        },
    )
    for identifier in (first["variant_id"], variant):
        await api.post(
            "/api/v1/cart/items",
            headers=customer,
            json={"variant_id": identifier, "quantity": 1},
        )
    order = (
        await api.post(
            "/api/v1/checkout/orders",
            headers=customer,
            json={
                "address": {
                    "name": "Customer",
                    "phone": "9800000000",
                    "line1": "Main street",
                    "city": "Kathmandu",
                    "country": "NP",
                },
                "payment_method": "cod",
                "idempotency_key": "real-bought-together-123",
            },
        )
    ).json()
    assert (
        await api.get("/api/v1/catalog/bought-together/lavender-journal")
    ).json() == []
    for status in ("packed", "shipped", "delivered"):
        assert (
            await api.patch(
                f"/api/v1/admin/orders/{order['id']}",
                headers=admin,
                json={"status": status},
            )
        ).status_code == 200
    result = (await api.get("/api/v1/catalog/bought-together/lavender-journal")).json()
    assert [item["id"] for item in result] == [second["id"]]
    await api.patch(
        f"/api/v1/admin/products/{second['id']}", headers=admin, json={"active": False}
    )
    assert (
        await api.get("/api/v1/catalog/bought-together/lavender-journal")
    ).json() == []


@pytest.mark.asyncio
async def test_inventory_variant_lookup_includes_inactive_products_and_requires_permission(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    ids = await catalog_item(api, admin)
    await api.patch(
        f"/api/v1/admin/products/{ids['product_id']}",
        headers=admin,
        json={"active": False},
    )
    assert (
        await api.get("/api/v1/inventory/variants", headers=customer)
    ).status_code == 403
    rows = (await api.get("/api/v1/inventory/variants", headers=admin)).json()
    assert rows[0]["id"] == ids["variant_id"]
    assert rows[0]["data"]["sku"] == "JOURNAL-LAV"


@pytest.mark.asyncio
async def test_admin_customer_update_validates_profile_types(
    api: AsyncClient, admin: dict[str, str], customer: dict[str, str]
) -> None:
    user = (await api.get("/api/v1/auth/me", headers=customer)).json()
    response = await api.patch(
        f"/api/v1/admin/customers/{user['id']}",
        headers=admin,
        json={"name": {"invalid": "object"}},
    )
    assert response.status_code == 422
    assert (await api.get("/api/v1/auth/me", headers=customer)).json()["name"] == user[
        "name"
    ]
