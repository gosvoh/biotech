import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createAuthTestClient } from "./auth-test-client";
import { consumeAuthQuota, getAuthClientAddress } from "./auth-rate-limit";
import { createAuthFixture } from "./auth-test-fixture";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
beforeAll(async () => { vi.stubEnv("AUTH_SECRET", "test-only-hmac-secret"); fixture = await createAuthFixture(); }, 30000);
beforeEach(async () => { await fixture.reset(); });
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
const start = new Date("2026-10-16T10:00:00Z");
const input = { scope: "email-minute", subject: "person@example.test", limit: 1, windowSeconds: 60, now: start };
it("enforces the minute boundary and persists across client recreation without storing the email", async () => {
  expect(await consumeAuthQuota(fixture.db, input)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  const reopened = createAuthTestClient(fixture.url);
  try { expect(await consumeAuthQuota(reopened, { ...input, now: new Date(+start + 59001) })).toEqual({ allowed: false, retryAfterSeconds: 1 }); }
  finally { await reopened.$disconnect(); }
  expect(await consumeAuthQuota(fixture.db, { ...input, now: new Date(+start + 60000) })).toEqual({ allowed: true, retryAfterSeconds: 0 });
  expect(JSON.stringify(await fixture.db.authRateLimit.findMany())).not.toContain(input.subject);
});
it("limits a rolling hour to five and a ten-minute request window to thirty", async () => {
  for (const [limit, windowSeconds] of [[5, 3600], [30, 600]]) {
    const quota = { ...input, scope: `window-${limit}`, limit, windowSeconds };
    for (let i = 0; i < limit; i++) expect((await consumeAuthQuota(fixture.db, { ...quota, now: new Date(+start + i * 1000) })).allowed).toBe(true);
    expect((await consumeAuthQuota(fixture.db, { ...quota, now: new Date(+start + windowSeconds * 1000 - 1) })).allowed).toBe(false);
    expect((await consumeAuthQuota(fixture.db, { ...quota, now: new Date(+start + windowSeconds * 1000) })).allowed).toBe(true);
    expect((await consumeAuthQuota(fixture.db, { ...quota, now: new Date(+start + windowSeconds * 1000) })).allowed).toBe(false);
  }
});
it("allows only one of twenty concurrent requests from independently connected clients", async () => {
  const second = createAuthTestClient(fixture.url);
  try {
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => consumeAuthQuota(index % 2 ? fixture.db : second, input)));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  } finally { await second.$disconnect(); }
});
it("preserves quota across a separate process without loading project environment files", async () => {
  await consumeAuthQuota(fixture.db, input);
  const script = `
    import fs from "node:fs";
    import { basename } from "node:path";
    const read = fs.readFileSync;
    fs.readFileSync = function(file, ...options) {
      if (/^\\.env(?:\\.|$)/.test(basename(String(file)))) throw new Error("Unexpected dotenv read");
      return read.call(this, file, ...options);
    };
    const { createAuthTestClient } = await import(${JSON.stringify(pathToFileURL(resolve("src/lib/auth-test-client.ts")).href)});
    import { consumeAuthQuota } from ${JSON.stringify(pathToFileURL(resolve("src/lib/auth-rate-limit.ts")).href)};
    const db = createAuthTestClient(process.env.DATABASE_URL);
    try { console.log(JSON.stringify(await consumeAuthQuota(db, {...${JSON.stringify(input)},now:new Date(${JSON.stringify(start.toISOString())})}))); }
    finally { await db.$disconnect(); }
  `;
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    env: { ...process.env, DATABASE_URL: fixture.url, AUTH_SECRET: "test-only-hmac-secret" }, encoding: "utf8", stdio: "pipe",
  });
  expect(JSON.parse(output)).toEqual({ allowed: false, retryAfterSeconds: 60 });
});
it("separates scope from subject and deletes at most one hundred expired rows per call", async () => {
  expect((await consumeAuthQuota(fixture.db, { ...input, scope: "a:b", subject: "c" })).allowed).toBe(true);
  expect((await consumeAuthQuota(fixture.db, { ...input, scope: "a", subject: "b:c" })).allowed).toBe(true);
  await fixture.db.authRateLimit.createMany({ data: Array.from({ length: 150 }, (_, i) => ({ key: `expired-${i}`, count: 1, expiresAt: new Date(+start - 1) })) });
  await consumeAuthQuota(fixture.db, input);
  expect(await fixture.db.authRateLimit.count({ where: { key: { startsWith: "expired-" } } })).toBe(50);
});
it("trusts only one configured IP header and canonicalizes IPv6 spelling", () => {
  expect(getAuthClientAddress(new Headers({ "x-forwarded-for": "1.2.3.4", forwarded: "for=1.2.3.4" }), undefined)).toBeNull();
  expect(getAuthClientAddress(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }), "x-real-ip")).toBe("1.2.3.4");
  for (const value of ["1.2.3.4, 5.6.7.8", "for=1.2.3.4", "1.2.3.4:80", "fe80::1%eth0", "garbage"]) expect(getAuthClientAddress(new Headers({ "x-real-ip": value }), "x-real-ip")).toBeNull();
  expect(getAuthClientAddress(new Headers({ "x-real-ip": "2001:0DB8:0:0:0:0:0:1" }), "x-real-ip")).toBe("2001:db8::1");
  expect(getAuthClientAddress(new Headers({ "x-real-ip": "::ffff:192.0.2.1" }), "x-real-ip")).toBe("192.0.2.1");
});
