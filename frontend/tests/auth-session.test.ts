// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { currentUser } from "@/features/auth/server";

const mocks = vi.hoisted(() => ({ cookie: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie }),
}));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_INTERNAL_URL", "http://backend:8000");
  fetchMock.mockReset();
  mocks.cookie.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("does not fetch user data without a cookie", async () => {
  expect(await currentUser()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("verifies the cookie with FastAPI before allowing access", async () => {
  mocks.cookie.mockReturnValue({ value: "opaque-token" });
  const user = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    email: "owner@example.com",
  };
  fetchMock.mockResolvedValue(Response.json(user));
  expect(await currentUser()).toEqual(expect.objectContaining(user));
  expect(fetchMock).toHaveBeenCalledWith(
    "http://backend:8000/api/v1/auth/me",
    expect.objectContaining({
      cache: "no-store",
      headers: expect.objectContaining({
        Authorization: "Bearer opaque-token",
      }),
    }),
  );
});
it("rejects expired backend sessions", async () => {
  mocks.cookie.mockReturnValue({ value: "expired-token" });
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  expect(await currentUser()).toBeNull();
});
it("reports backend outages instead of silently granting access", async () => {
  mocks.cookie.mockReturnValue({ value: "opaque-token" });
  fetchMock.mockRejectedValue(new Error("offline"));
  await expect(currentUser()).rejects.toThrow("Sign-in service is unavailable");
});
