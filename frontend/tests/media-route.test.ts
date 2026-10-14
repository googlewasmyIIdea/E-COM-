// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/media/[name]/route";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("serves valid uploaded WebP names through the backend", async () => {
  vi.stubEnv("API_INTERNAL_URL", "http://backend:8000");
  const mock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
  vi.stubGlobal("fetch", mock);
  const name = "123e4567-e89b-42d3-a456-426614174000.webp";
  const response = await GET(
    new Request(`http://localhost:3000/media/${name}`),
    { params: Promise.resolve({ name }) },
  );
  expect(response.status).toBe(200);
  expect(mock).toHaveBeenCalled();
});
it("rejects arbitrary media paths", async () => {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  expect(
    (
      await GET(new Request("http://localhost:3000/media/private.env"), {
        params: Promise.resolve({ name: "private.env" }),
      })
    ).status,
  ).toBe(404);
  expect(mock).not.toHaveBeenCalled();
});
