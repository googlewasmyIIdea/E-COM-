// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/inventory/[resource]/route";

const fetchMock = vi.fn<typeof fetch>();
const context = { params: Promise.resolve({ resource: "stock" }) };
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
it("requires a session cookie", async () => {
  const response = await GET(
    new NextRequest("http://localhost:3000/api/inventory/stock"),
    context,
  );
  expect(response.status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards the private cookie token to FastAPI", async () => {
  fetchMock.mockResolvedValue(Response.json([]));
  const response = await GET(
    new NextRequest("http://localhost:3000/api/inventory/stock", {
      headers: { Cookie: "inventory_session=opaque-token" },
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://backend:8000/api/v1/inventory/stock",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer opaque-token",
      }),
    }),
  );
});
it("rejects arbitrary proxy destinations", async () => {
  const response = await GET(
    new NextRequest("http://localhost:3000/api/inventory/anything"),
    { params: Promise.resolve({ resource: "anything" }) },
  );
  expect(response.status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects cross-origin reservation requests", async () => {
  const response = await POST(
    new NextRequest("http://localhost:3000/api/inventory/reservations", {
      method: "POST",
      headers: {
        Origin: "https://foreign.example",
        Cookie: "inventory_session=opaque-token",
      },
      body: "{}",
    }),
    { params: Promise.resolve({ resource: "reservations" }) },
  );
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
