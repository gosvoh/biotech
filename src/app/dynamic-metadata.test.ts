import { beforeEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/site";
const db = vi.hoisted(() => ({ news: { findUnique: vi.fn() }, member: { findUnique: vi.fn() } }));
vi.mock("@/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/components/markdown-render", () => ({ default: () => null }));
vi.mock("@/components/news-images-carousel", () => ({ default: () => null }));
vi.mock("@/components/news-carousel-section", () => ({ default: () => null }));
import { generateMetadata as newsMetadata } from "./news/[id]/page";
import { generateMetadata as memberMetadata } from "./team/[id]/page";
import newsOG from "./news/[id]/opengraph-image";
import newsTwitter from "./news/[id]/twitter-image";
import memberOG from "./team/[id]/opengraph-image";
import memberTwitter from "./team/[id]/twitter-image";

describe("dynamic metadata", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses the news title and distinct image routes", async () => {
    db.news.findUnique.mockResolvedValue({ title: "Новость", date: "2026-06-01", hidden: false });
    const meta = await newsMetadata({ params: Promise.resolve({ id: "123" }) });
    expect(meta.alternates?.canonical).toBe(siteUrl("/news/123"));
    expect(meta.openGraph).toMatchObject({ title: "Биотех ИТМО | Новость", url: siteUrl("/news/123"), images: { url: siteUrl("/news/123/opengraph-image") } });
    expect(meta.twitter).toMatchObject({ images: { url: siteUrl("/news/123/twitter-image") } });
  });
  it("uses the member name and profile URL", async () => {
    db.member.findUnique.mockResolvedValue({ firstName: "Иван", middleName: "Иванович", lastName: "Иванов" });
    const meta = await memberMetadata({ params: Promise.resolve({ id: "42" }) });
    expect(meta.alternates?.canonical).toBe(siteUrl("/team/42"));
    expect(meta.openGraph).toMatchObject({ title: "Биотех ИТМО | Иван Иванович Иванов", url: siteUrl("/team/42"), images: { url: siteUrl("/team/42/opengraph-image") } });
    expect(meta.twitter).toMatchObject({ images: { url: siteUrl("/team/42/twitter-image") } });
  });
  it.each([null, { hidden: true }])("rejects missing or hidden news in metadata and both images", async (news) => {
    db.news.findUnique.mockResolvedValue(news);
    for (const handler of [newsMetadata, newsOG, newsTwitter]) {
      await expect(handler({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(db.news.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "missing" } }));
  });
  it("rejects missing members and awaits image parameters", async () => {
    db.member.findUnique.mockResolvedValue(null);
    for (const handler of [memberMetadata, memberOG, memberTwitter]) {
      await expect(handler({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(db.member.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "missing" } }));
  });
});
