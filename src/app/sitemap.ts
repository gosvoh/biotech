import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/prisma";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("minutes");
  cacheTag("news", "members");
  const [news, members] = await Promise.all([
    prisma.news.findMany({
      where: { hidden: false },
      select: { id: true, updatedAt: true },
    }),
    prisma.member.findMany({ select: { id: true, updatedAt: true } }),
  ]);
  const routes = [
    "/", "/news", "/team", "/research",
    "/education", "/education/vkr", "/contacts",
  ];
  return [
    ...routes.map((route) => ({ url: siteUrl(route) })),
    ...news.map(({ id, updatedAt }) => ({
      url: siteUrl(`/news/${encodeURIComponent(id)}`),
      lastModified: updatedAt,
    })),
    ...members.map(({ id, updatedAt }) => ({
      url: siteUrl(`/team/${encodeURIComponent(id)}`),
      lastModified: updatedAt,
    })),
  ];
}
