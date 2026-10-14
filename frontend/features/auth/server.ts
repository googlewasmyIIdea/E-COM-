import "server-only";
import { cookies } from "next/headers";
import { userSchema, type User } from "./schemas";

export const SESSION_COOKIE = "inventory_session";
export const SERVICE_UNAVAILABLE =
  "Sign-in service is unavailable. Please try again shortly.";

export async function backendRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = process.env.API_INTERNAL_URL;
  if (!baseUrl) throw new Error(SERVICE_UNAVAILABLE);
  try {
    return await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(SERVICE_UNAVAILABLE);
  }
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentUser(): Promise<User | null> {
  const token = await sessionToken();
  if (!token) return null;
  const response = await backendRequest("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(SERVICE_UNAVAILABLE);
  const parsed = userSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(SERVICE_UNAVAILABLE);
  return parsed.data;
}
