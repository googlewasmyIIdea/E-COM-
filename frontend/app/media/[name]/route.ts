import { backendRequest } from "@/features/auth/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[0-9a-f-]{36}\.webp$/.test(name))
    return new Response(null, { status: 404 });
  const response = await backendRequest(`/media/${name}`);
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
