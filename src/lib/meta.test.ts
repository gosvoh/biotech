import { describe, expect, it } from "vitest";
import { generateMeta } from "@/lib/meta";

describe("generateMeta", () => {
  it("sets the title and description on the base metadata", () => {
    const meta = generateMeta("Title", "Description");
    expect(meta.title).toBe("Title");
    expect(meta.description).toBe("Description");
    expect(meta.openGraph?.title).toBe("Title");
    expect(meta.openGraph?.description).toBe("Description");
  });

  it("uses the absolute imageBaseUrl as-is when it starts with http", () => {
    const meta = generateMeta("T", "D", "https://example.com/img");
    const og = meta.openGraph as { images: { url: string } };
    expect(og.images.url).toBe("https://example.com/img/opengraph-image");
  });

  it("prefixes a relative imageBaseUrl with the production origin", () => {
    const meta = generateMeta("T", "D", "/news/1");
    const og = meta.openGraph as { images: { url: string } };
    expect(og.images.url).toBe(
      "https://biotech.cedne.ru/news/1/opengraph-image",
    );
  });

  it("falls back to the production origin when no imageBaseUrl is given", () => {
    const meta = generateMeta("T", "D");
    const tw = meta.twitter as { images: { url: string } };
    expect(tw.images.url).toBe("https://biotech.cedne.ru/opengraph-image");
  });
});
