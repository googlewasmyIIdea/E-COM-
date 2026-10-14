import { userSchema, type Credentials, type User } from "./schemas";

async function submit(path: string, body?: Credentials): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Unable to connect. Check your connection and try again.");
  }
  if (!response.ok) {
    let message = "Unable to complete your request. Please try again.";
    try {
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "detail" in payload &&
        typeof payload.detail === "string"
      ) {
        message = payload.detail;
      }
    } catch {
      /* Preserve a readable error for non-JSON gateway responses. */
    }
    throw new Error(message);
  }
}

export async function signIn(credentials: Credentials): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : "Unable to sign in. Please try again.";
    throw new Error(detail);
  }
  if (typeof payload !== "object" || payload === null || !("user" in payload))
    throw new Error("Unexpected sign-in response.");
  // Merge the guest cart after the backend has authenticated the customer.
  const merged = await fetch("/api/commerce/cart/merge", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!merged.ok && merged.status !== 409)
    throw new Error(
      "Signed in, but the cart could not be merged. Please refresh.",
    );
  return userSchema.parse(payload.user);
}
export async function signOut(): Promise<void> {
  return submit("/api/auth/logout");
}
