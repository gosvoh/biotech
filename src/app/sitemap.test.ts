import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL, siteUrl } from "@/lib/site";
const db = vi.hoisted(() => ({ news: { findMany: vi.fn() }, member: { findMany: vi.fn() } }));
vi.mock("@/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
import sitemap from "./sitemap";
import robots from "./robots";

describe("crawler routes", () => {
  beforeEach(() => vi.clearAllMocks());
  it("lists public routes and visible entities with real timestamps", async () => {
    const updatedAt = new Date("2026-06-01T12:00:00Z");
    db.news.findMany.mockResolvedValue([{ id: "123", updatedAt }]);
    db.member.findMany.mockResolvedValue([{ id: "42", updatedAt }]);
    const entries = await sitemap();
    const routes = ["/", "/news", "/team", "/research", "/education", "/education/vkr", "/contacts"];
    expect(entries.slice(0, 7)).toEqual(routes.map((path) => ({ url: siteUrl(path) })));
    expect(entries.slice(7)).toEqual([
      { url: siteUrl("/news/123"), lastModified: updatedAt },
      { url: siteUrl("/team/42"), lastModified: updatedAt },
    ]);
    expect(db.news.findMany).toHaveBeenCalledWith({ where: { hidden: false }, select: { id: true, updatedAt: true } });
    expect(db.member.findMany).toHaveBeenCalledWith({ select: { id: true, updatedAt: true } });
    expect(entries.every(({ url }) => url.startsWith(`${SITE_URL}/`))).toBe(true);
  });
  it("does not invent entities in an empty database", async () => {
    db.news.findMany.mockResolvedValue([]);
    db.member.findMany.mockResolvedValue([]);
    expect(await sitemap()).toHaveLength(7);
  });
  it("does not cache a silently incomplete sitemap on a DB failure", async () => {
    db.news.findMany.mockRejectedValue(new Error("unavailable"));
    db.member.findMany.mockResolvedValue([]);
    await expect(sitemap()).rejects.toThrow("unavailable");
  });
  it("allows public pages and points to the production sitemap", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }, sitemap: siteUrl("/sitemap.xml") });
  });
});
