// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

const token = "a".repeat(43);
const user = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  email: "owner@example.com",
};
const fetchMock = vi.fn<typeof fetch>();

function request(
  path: string,
  body?: object,
  origin = "http://localhost:3000",
  cookie?: string,
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

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

describe("login backend connection", () => {
  it("sets an HttpOnly session cookie and never exposes the backend token in JSON", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        session_token: token,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user,
      }),
    );
    const response = await login(
      request("/api/auth/login", {
        email: "owner@example.com",
        password: "secret",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: expect.objectContaining(user),
    });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:8000/api/v1/auth/login",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });
  it("sets Secure cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValue(
      Response.json({
        session_token: token,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user,
      }),
    );
    const response = await login(
      request("/api/auth/login", {
        email: "owner@example.com",
        password: "secret",
      }),
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
  it("rejects cross-origin submissions before contacting FastAPI", async () => {
    expect(
      (
        await login(
          request(
            "/api/auth/login",
            { email: "owner@example.com", password: "secret" },
            "https://foreign.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects invalid credentials locally", async () => {
    expect(
      (await login(request("/api/auth/login", { email: "bad", password: "" })))
        .status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a helpful message for invalid backend credentials", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ detail: "Invalid email or password" }, { status: 401 }),
    );
    const response = await login(
      request("/api/auth/login", {
        email: "owner@example.com",
        password: "wrong",
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      detail: "Invalid email or password",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("handles backend unavailability without exposing internal errors", async () => {
    fetchMock.mockRejectedValue(new Error("internal host info"));
    const response = await login(
      request("/api/auth/login", {
        email: "owner@example.com",
        password: "secret",
      }),
    );
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "internal host info",
    );
  });
  it("rejects malformed successful backend responses", async () => {
    fetchMock.mockResolvedValue(Response.json({ session_token: token }));
    expect(
      (
        await login(
          request("/api/auth/login", {
            email: "owner@example.com",
            password: "secret",
          }),
        )
      ).status,
    ).toBe(502);
  });
});

describe("logout", () => {
  it("revokes the backend session and clears the cookie", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "Signed out" }));
    const response = await logout(
      request(
        "/api/auth/logout",
        undefined,
        undefined,
        `inventory_session=${token}`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:8000/api/v1/auth/logout",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      }),
    );
  });
  it("keeps the session available to retry if backend revocation fails", async () => {
    fetchMock.mockRejectedValue(new Error("unreachable"));
    const response = await logout(
      request(
        "/api/auth/logout",
        undefined,
        undefined,
        `inventory_session=${token}`,
      ),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("clears an already expired session", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ detail: "Expired" }, { status: 401 }),
    );
    expect(
      (
        await logout(
          request(
            "/api/auth/logout",
            undefined,
            undefined,
            `inventory_session=${token}`,
          ),
        )
      ).status,
    ).toBe(200);
  });
  it("rejects cross-origin sign out", async () => {
    expect(
      (
        await logout(
          request("/api/auth/logout", undefined, "https://foreign.example"),
        )
      ).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
