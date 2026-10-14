from backend.main import app


def test_inventory_route_contracts() -> None:
    schema = app.openapi()
    for resource in ("warehouses", "stock", "reservations", "alerts", "replenishments"):
        operation = schema["paths"][f"/api/v1/inventory/{resource}"]["get"]
        assert operation["security"]
        assert operation["responses"]["200"]["content"]["application/json"]["schema"]


def test_reservation_contract() -> None:
    schema = app.openapi()
    operation = schema["paths"]["/api/v1/inventory/reservations"]["post"]
    assert operation["requestBody"]["content"]["application/json"]["schema"]
    assert "201" in operation["responses"]
