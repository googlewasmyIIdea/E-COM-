import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  backendRequest,
  currentUser,
  SESSION_COOKIE,
} from "@/features/auth/server";
import type { User } from "@/features/auth/schemas";

export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function serverRequest<T>(
  path: string,
  authenticated = false,
): Promise<T> {
  const token = authenticated
    ? (await cookies()).get(SESSION_COOKIE)?.value
    : undefined;
  const response = await backendRequest(`/api/v1/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : "The service is temporarily unavailable.";
    throw new BackendError(message, response.status);
  }
  return payload as T;
}
export async function requireCustomer(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireManagement(permission?: string): Promise<User> {
  const user = await requireCustomer();
  if (
    user.role === "admin" ||
    (user.role === "staff" &&
      (!permission ||
        user.permissions.includes(permission) ||
        (permission === "inventory.view" &&
          user.permissions.includes("inventory.manage"))))
  )
    return user;
  redirect("/account?notice=restricted");
}
