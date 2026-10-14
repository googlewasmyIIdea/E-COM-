export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function rawRequest<T>(
  path: string,
  options?: { method?: string; body?: object },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/commerce/${path}`, {
      method: options?.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Unable to connect. Please try again.", 503);
  }
  const payload: unknown = await response.json();
  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : "Unable to complete this request.";
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}
export function cartChanged(): void {
  window.dispatchEvent(new Event("cart-changed"));
}

let guestReady = false;
let initialization: Promise<unknown> | undefined;
export async function request<T>(
  path: string,
  options?: { method?: string; body?: object },
): Promise<T> {
  if (path.startsWith("cart") && !guestReady) {
    if (!initialization) initialization = rawRequest("cart");
    let initial: unknown;
    try {
      initial = await initialization;
      guestReady = true;
    } catch (error) {
      initialization = undefined;
      throw error;
    }
    if (path === "cart" && (!options?.method || options.method === "GET"))
      return initial as T;
  }
  return rawRequest<T>(path, options);
}
