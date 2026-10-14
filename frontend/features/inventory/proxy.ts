import "server-only";
import type { NextRequest } from "next/server";
import { hasValidOrigin, jsonResponse } from "@/features/auth/handlers";
import {
  backendRequest,
  SERVICE_UNAVAILABLE,
  SESSION_COOKIE,
} from "@/features/auth/server";
import { inventoryRoutes } from "./routes";

type Context = { params: Promise<{ resource: string }> };

async function proxy(
  request: NextRequest,
  context: Context,
  method: "GET" | "POST",
) {
  const { resource } = await context.params;
  if (!Object.hasOwn(inventoryRoutes, resource))
    return jsonResponse({ detail: "Route not found." }, 404);
  if (method === "POST" && resource !== "reservations")
    return jsonResponse({ detail: "Method not allowed." }, 405);
  if (method === "POST" && !hasValidOrigin(request))
    return jsonResponse({ detail: "Invalid request origin." }, 403);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token)
    return jsonResponse({ detail: "Please sign in to continue." }, 401);
  const path = inventoryRoutes[resource as keyof typeof inventoryRoutes];
  let body: string | undefined;
  if (method === "POST") {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      return jsonResponse({ detail: "Invalid request." }, 400);
    }
  }
  try {
    const response = await backendRequest(`${path}${request.nextUrl.search}`, {
      method,
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null)
      return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 502);
    return jsonResponse(payload, response.status);
  } catch {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
  }
}

export async function inventoryGet(request: NextRequest, context: Context) {
  return proxy(request, context, "GET");
}
export async function inventoryPost(request: NextRequest, context: Context) {
  return proxy(request, context, "POST");
}
