import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PrismaClient } from "@/lib/db/client";
import { createAuthTestClient } from "@/lib/auth-test-client";

const mocks = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock("@/prisma", () => ({ get prisma() { return mocks.db; } }));
import { getNews } from "@/app/news/actions";

let directory: string;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-news-order-"));
  cpSync("schema.prisma", join(directory, "schema.prisma"));
  cpSync("migrations", join(directory, "migrations"), { recursive: true });
  const url = `file:${join(directory, "test.db")}`;
  writeFileSync(join(directory, "test.db"), "");
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
    env: { ...process.env, DATABASE_URL: url, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe",
  });
  mocks.db = createAuthTestClient(url);
  await mocks.db.newsTags.create({ data: { id: "science", title: "Наука" } });
  for (const [id, date, hidden] of [
    ["old", "Wed, 06 Aug 2025 13:26:45 GMT", false],
    ["middle", "Fri, 02 Jan 2026 12:00:00 GMT", false],
    ["newest", "2026-10-16", false],
    ["newer", "2026-09-01", false],
    ["hidden", "2027-01-01", true],
  ] as const) {
    await mocks.db.news.create({ data: { id, date, hidden, title: id, text: "", links: "", tags: id === "old" ? undefined : { connect: { id: "science" } } } });
  }
}, 30000);
afterAll(async () => {
  await mocks.db?.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it("shows the newest publication dates first across legacy and ISO dates, before pagination", async () => {
  const [first, total] = await getNews();
  const [second] = await getNews(1);
  expect(first.map((item) => item.id)).toEqual(["newest", "newer", "middle"]);
  expect(second.map((item) => item.id)).toEqual(["old"]);
  expect(total).toBe(4);
});

it("preserves tag filtering and excludes hidden news", async () => {
  const [news, total] = await getNews(0, ["science"]);
  expect(news.map((item) => item.id)).toEqual(["newest", "newer", "middle"]);
  expect(total).toBe(3);
});
