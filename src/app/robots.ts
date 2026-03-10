import { MetadataRoute } from "next";
import { ADMIN_ROUTE_PREFIX } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://oursacredspace.netlify.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [`${ADMIN_ROUTE_PREFIX}/`, "/api/", "/success", "/verify"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
