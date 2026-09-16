import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { generateMeta } from "@/lib/meta";
import { SITE_URL, siteUrl } from "@/lib/site";

describe("production metadata", () => {
  it("pins the public HTTPS origin", () => {
    expect(new URL(SITE_URL).hostname).toBe("biotech.itmo.ru");
    expect(new URL(SITE_URL).protocol).toBe("https:");
  });

  it.each(["/", "/education", "/education/vkr", "/news", "/team", "/research", "/contacts", "/news/123", "/team/42"])("builds page-specific metadata for %s", (path) => {
    const meta = generateMeta("Title", "Description", path);
    const url = siteUrl(path);
    expect(meta.title).toEqual({ absolute: "Title" });
    expect(meta.description).toBe("Description");
    expect(meta.metadataBase?.href).toBe(`${SITE_URL}/`);
    expect(meta.alternates?.canonical).toBe(url);
    expect(meta.icons).toBe("/favicon.ico");
    expect(meta.openGraph).toMatchObject({
      title: "Title", description: "Description", url, type: "website",
      images: { url: `${url.replace(/\/$/, "")}/opengraph-image`, width: 1920, height: 960 },
    });
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image", title: "Title", description: "Description",
      images: { url: `${url.replace(/\/$/, "")}/twitter-image` },
    });
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "/news?foo=bar", "/news#fragment"])("rejects non-path inputs: %s", (path) => {
    expect(() => siteUrl(path)).toThrow();
  });

  it("keeps tracked source files free of the retired host", () => {
    // Assemble the forbidden hostname so the guard itself is not a stale URL.
    const retiredHost = ["cedne", "ru"].join(".");
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    for (const file of files) {
      const content = readFileSync(file);
      if (!content.includes(0)) expect(content.toString(), file).not.toContain(retiredHost);
    }
  });
});
