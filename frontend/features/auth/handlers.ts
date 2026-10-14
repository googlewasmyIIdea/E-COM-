import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  credentialsSchema,
  loginResponseSchema,
  registrationSchema,
} from "./schemas";
import { backendRequest, SERVICE_UNAVAILABLE, SESSION_COOKIE } from "./server";

export function jsonResponse(body: object, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function hasValidOrigin(request: NextRequest): boolean {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  return request.headers.get("origin") === expected;
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export async function handleLogin(request: NextRequest): Promise<NextResponse> {
  if (!hasValidOrigin(request))
    return jsonResponse({ detail: "Invalid request origin." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid request." }, 400);
  }
  const credentials = credentialsSchema.safeParse(body);
  if (!credentials.success)
    return jsonResponse(
      { detail: "Enter a valid email address and password." },
      400,
    );
  let backend: Response;
  try {
    backend = await backendRequest("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials.data),
    });
  } catch {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
  }
  if (backend.status === 401)
    return jsonResponse({ detail: "Invalid email or password" }, 401);
  if (backend.status === 429)
    return jsonResponse(
      { detail: "Too many sign-in attempts. Please try again in 15 minutes." },
      429,
    );
  if (!backend.ok) return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
  let payload: unknown;
  try {
    payload = await backend.json();
  } catch {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 502);
  }
  const parsed = loginResponseSchema.safeParse(payload);
  if (!parsed.success || Date.parse(parsed.data.expires_at) <= Date.now()) {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 502);
  }
  const response = jsonResponse({ user: parsed.data.user });
  response.cookies.set(SESSION_COOKIE, parsed.data.session_token, {
    ...cookieOptions(),
    expires: new Date(parsed.data.expires_at),
  });
  return response;
}

export async function handleLogout(
  request: NextRequest,
): Promise<NextResponse> {
  if (!hasValidOrigin(request))
    return jsonResponse({ detail: "Invalid request origin." }, 403);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const backend = await backendRequest("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!backend.ok && backend.status !== 401)
        return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
    } catch {
      return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
    }
  }
  const response = jsonResponse({ detail: "Signed out" });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}

export async function handleRegister(
  request: NextRequest,
): Promise<NextResponse> {
  if (!hasValidOrigin(request))
    return jsonResponse({ detail: "Invalid request origin." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid request." }, 400);
  }
  const parsedInput = registrationSchema.safeParse(body);
  if (!parsedInput.success)
    return jsonResponse(
      {
        detail:
          "Enter your name, a valid email, and a password with at least 10 characters including letters and numbers.",
      },
      400,
    );
  try {
    const backend = await backendRequest("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(parsedInput.data),
    });
    if (backend.status === 409)
      return jsonResponse(
        { detail: "An account with this email already exists." },
        409,
      );
    if (!backend.ok)
      return jsonResponse(
        {
          detail:
            "Unable to create your account. Check your details and try again.",
        },
        backend.status,
      );
    const parsed = loginResponseSchema.safeParse(await backend.json());
    if (!parsed.success)
      return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 502);
    const response = jsonResponse({ user: parsed.data.user }, 201);
    response.cookies.set(SESSION_COOKIE, parsed.data.session_token, {
      ...cookieOptions(),
      expires: new Date(parsed.data.expires_at),
    });
    return response;
  } catch {
    return jsonResponse({ detail: SERVICE_UNAVAILABLE }, 503);
  }
}
