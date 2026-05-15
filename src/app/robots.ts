import type { MetadataRoute } from "next";

const siteUrl = "https://starboard.workers.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/stars"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
