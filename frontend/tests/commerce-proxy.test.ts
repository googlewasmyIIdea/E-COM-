// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { commerceProxy } from "@/features/commerce/proxy";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_INTERNAL_URL", "http://backend:8000");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("allows public catalog reads", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ items: [], total: 0, page: 1, page_size: 12 }),
  );
  const response = await commerceProxy(
    new NextRequest(
      "http://localhost:3000/api/commerce/catalog/products?q=pen",
    ),
    { params: Promise.resolve({ path: ["catalog", "products"] }) },
  );
  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://backend:8000/api/v1/catalog/products?q=pen",
    expect.objectContaining({ cache: "no-store" }),
  );
});
it("rejects cross-origin cart mutations", async () => {
  const response = await commerceProxy(
    new NextRequest("http://localhost:3000/api/commerce/cart/items", {
      method: "POST",
      headers: { Origin: "https://foreign.example" },
      body: "{}",
    }),
    { params: Promise.resolve({ path: ["cart", "items"] }) },
  );
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("creates a private guest cookie for a guest cart", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ id: "cart", items: [], count: 0, subtotal: "0" }),
  );
  const response = await commerceProxy(
    new NextRequest("http://localhost:3000/api/commerce/cart"),
    { params: Promise.resolve({ path: ["cart"] }) },
  );
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(fetchMock).toHaveBeenCalledWith(
    "http://backend:8000/api/v1/cart",
    expect.objectContaining({
      headers: expect.objectContaining({ "X-Guest-Cart": expect.any(String) }),
    }),
  );
});
it("does not hide backend authorization failures", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ detail: "Forbidden" }, { status: 403 }),
  );
  const response = await commerceProxy(
    new NextRequest("http://localhost:3000/api/commerce/admin/products", {
      headers: { Cookie: "inventory_session=opaque-token" },
    }),
    { params: Promise.resolve({ path: ["admin", "products"] }) },
  );
  expect(response.status).toBe(403);
});
it("rejects unknown proxy destinations", async () => {
  const response = await commerceProxy(
    new NextRequest("http://localhost:3000/api/commerce/unknown"),
    { params: Promise.resolve({ path: ["unknown"] }) },
  );
  expect(response.status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
