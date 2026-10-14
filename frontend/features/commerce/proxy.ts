import "server-only";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, jsonResponse } from "@/features/auth/handlers";
import {
  backendRequest,
  SERVICE_UNAVAILABLE,
  SESSION_COOKIE,
} from "@/features/auth/server";

export const GUEST_COOKIE = "paper_petal_cart";
const allowed = new Set([
  "catalog",
  "store",
  "cart",
  "checkout",
  "orders",
  "account",
  "admin",
  "inventory",
  "payments",
  "newsletter",
  "auth",
]);
export async function commerceProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  if (!allowed.has(path[0]) || path.some((p) => !/^[a-zA-Z0-9_-]+$/.test(p)))
    return jsonResponse({ detail: "Route not found." }, 404);
  if (path[0] === "auth" && !["password", "verification"].includes(path[1]))
    return jsonResponse({ detail: "Route not found." }, 404);
  if (request.method !== "GET" && !hasValidOrigin(request))
    return jsonResponse({ detail: "Invalid request origin." }, 403);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let guest = request.cookies.get(GUEST_COOKIE)?.value;
  const newGuest = !guest && path[0] === "cart";
  if (newGuest) guest = randomBytes(32).toString("base64url");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (guest) headers["X-Guest-Cart"] = guest;
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.arrayBuffer();
    if (body.byteLength > 9 * 1024 * 1024)
      return jsonResponse({ detail: "Request is too large." }, 413);
  }
  try {
    const backend = await backendRequest(
      `/api/v1/${path.join("/")}${request.nextUrl.search}`,
      { method: request.method, headers, body },
    );
    const type = backend.headers.get("content-type") ?? "application/json";
    const response = new NextResponse(await backend.arrayBuffer(), {
      status: backend.status,
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        ...(backend.headers.get("content-disposition")
          ? {
              "Content-Disposition": backend.headers.get(
                "content-disposition",
              )!,
            }
          : {}),
      },
    });
    if (newGuest && guest)
      response.cookies.set(GUEST_COOKIE, guest, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    return response;
  } catch {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
  }
}
