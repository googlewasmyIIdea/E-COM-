import type { MetadataRoute } from "next";
import { serverRequest } from "@/features/commerce/server";
import type { ProductPage } from "@/features/commerce/types";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const result: MetadataRoute.Sitemap = [
    "",
    "/shop",
    "/shipping",
    "/returns",
    "/contact",
  ].map((path) => ({
    url: origin + path,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
  try {
    let page = 1;
    while (true) {
      const products = await serverRequest<ProductPage>(
        `catalog/products?page_size=60&page=${page}`,
      );
      result.push(
        ...products.items.map((p) => ({
          url: `${origin}/products/${p.slug}`,
          lastModified: new Date(p.created_at),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      );
      if (page * products.page_size >= products.total) break;
      page++;
    }
  } catch {
    /* Static public pages remain available during an API outage. */
  }
  return result;
}

export const dynamic = "force-dynamic";
