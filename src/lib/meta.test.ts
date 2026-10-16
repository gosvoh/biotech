import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateMeta } from "@/lib/meta";
import { SITE_URL, siteUrl } from "@/lib/site";

function currentSourceFiles(cwd = process.cwd()) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd, encoding: "utf8" })
    .split("\0").filter(file => file && existsSync(resolve(cwd, file)));
}

it("scans current Git files after tracked deletions and includes new nonignored files", () => {
  const directory = mkdtempSync(join(tmpdir(), "biotech-meta-files-"));
  try {
    execFileSync("git", ["init", "--quiet", directory]);
    writeFileSync(join(directory, "deleted.ts"), "old");
    writeFileSync(join(directory, "kept.ts"), "current");
    execFileSync("git", ["add", "deleted.ts", "kept.ts"], { cwd: directory });
    unlinkSync(join(directory, "deleted.ts"));
    writeFileSync(join(directory, "new.ts"), "new");
    writeFileSync(join(directory, ".gitignore"), "ignored.ts\n");
    writeFileSync(join(directory, "ignored.ts"), "ignored");
    expect(currentSourceFiles(directory).sort()).toEqual([".gitignore", "kept.ts", "new.ts"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

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
    expect(meta.metadataBase).toEqual(new URL(SITE_URL));
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
    const files = currentSourceFiles();
    for (const file of files) {
      const content = readFileSync(file);
      if (!content.includes(0)) expect(content.toString(), file).not.toContain(retiredHost);
    }
  });
});
