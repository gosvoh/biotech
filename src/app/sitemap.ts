import type { MetadataRoute } from "next";

const BASE_URL = "https://biotech.cedne.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/news",
    "/team",
    "/research",
    "/education",
    "/education/vkr",
    "/contacts",
  ];

  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
  }));
}
