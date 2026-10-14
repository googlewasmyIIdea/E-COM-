// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
it("initializes one guest cart before simultaneous item mutations", async () => {
  const events: string[] = [];
  let finish: ((value: Response) => void) | undefined;
  const first = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const mock = vi.fn<typeof fetch>().mockImplementation((url) => {
    events.push(String(url));
    return events.length === 1
      ? first
      : Promise.resolve(Response.json({ count: 1 }));
  });
  vi.stubGlobal("fetch", mock);
  const { request } = await import("@/features/commerce/client");
  const one = request("cart/items", {
    method: "POST",
    body: { variant_id: "one", quantity: 1 },
  });
  const two = request("cart/items", {
    method: "POST",
    body: { variant_id: "two", quantity: 1 },
  });
  expect(events).toEqual(["/api/commerce/cart"]);
  finish?.(Response.json({ count: 0, items: [] }));
  await Promise.all([one, two]);
  expect(events).toEqual([
    "/api/commerce/cart",
    "/api/commerce/cart/items",
    "/api/commerce/cart/items",
  ]);
});
