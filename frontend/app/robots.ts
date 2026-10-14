import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/inventory",
        "/account",
        "/checkout",
        "/cart",
        "/api/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
