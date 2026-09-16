/** Run against a built app: bun run seo:check http://localhost:3000 /news/<id> /team/<id> */
import assert from "node:assert/strict";
import { SITE_URL, siteUrl } from "../src/lib/site";

const base = process.argv[2] ?? "http://localhost:3000";
const routes = ["/", "/news", "/team", "/research", "/education", "/education/vkr", "/contacts", ...process.argv.slice(3)];
const checkedImages = new Set<string>();

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

for (const route of routes) {
  const response = await fetch(new URL(route, base), { headers: { "User-Agent": "TelegramBot (like TwitterBot)" }, redirect: "manual" });
  assert.equal(response.status, 200, route);
  assert(!/noindex/i.test(response.headers.get("x-robots-tag") ?? ""), route);
  const html = await response.text();
  const head = html.split("</head>")[0];
  const tags = [...head.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(([tag]) => attributes(tag));
  const meta = (key: string) => tags.find((tag) => tag.property === key || tag.name === key)?.content;
  assert.equal(new URL(tags.find((tag) => tag.rel === "canonical")!.href).href, siteUrl(route), `canonical: ${route}`);
  assert.equal(new URL(meta("og:url")!).href, siteUrl(route), `og:url: ${route}`);
  for (const key of ["description", "og:title", "og:description", "og:type", "og:image:width", "og:image:height", "twitter:title", "twitter:description"]) {
    assert(meta(key), `${key} missing from head: ${route}`);
  }
  assert.equal(meta("twitter:card"), "summary_large_image");
  assert(!/noindex/i.test(meta("robots") ?? ""));
  for (const [key, suffix] of [["og:image", "opengraph-image"], ["twitter:image", "twitter-image"]]) {
    const url = new URL(meta(key)!);
    assert.equal(url.origin, SITE_URL);
    assert.equal(url.pathname, `${route.replace(/\/$/, "")}/${suffix}`);
    if (checkedImages.has(url.href)) continue;
    const image = await fetch(new URL(url.pathname + url.search, base), { redirect: "manual" });
    assert.equal(image.status, 200, url.href);
    assert.match(image.headers.get("content-type") ?? "", /^image\/png\b/);
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
    assert.equal(bytes.readUInt32BE(16), 1920);
    assert.equal(bytes.readUInt32BE(20), 960);
    checkedImages.add(url.href);
  }
  console.log(`PASS HTML + OG/Twitter PNG: ${route}`);
}
const robots = await fetch(new URL("/robots.txt", base));
assert.equal(robots.status, 200);
assert((await robots.text()).includes(`Sitemap: ${siteUrl("/sitemap.xml")}`));
const sitemap = await fetch(new URL("/sitemap.xml", base));
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(locations.length >= 7);
for (const location of locations) {
  assert.equal(new URL(location).origin, SITE_URL);
  assert(!/^\/(?:admin|api)(?:\/|$)/.test(new URL(location).pathname));
}
for (const route of routes) assert(locations.includes(siteUrl(route)), `Missing sitemap entry: ${route}`);
console.log(`PASS robots + sitemap (${locations.length} URLs)`);
