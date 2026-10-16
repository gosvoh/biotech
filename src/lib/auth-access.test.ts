import { afterAll, beforeAll, expect, it } from "vitest";
import { getApprovedAccount, normalizeAdminEmail } from "./auth-access";
import { createAuthFixture } from "./auth-test-fixture";
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
beforeAll(async () => { fixture = await createAuthFixture(); }, 30000);
afterAll(async () => { await fixture?.close(); });
it("normalizes a single address and rejects address lists, display names and controls", () => {
  expect(normalizeAdminEmail("  Editor+News@Example.TEST  ")).toBe("editor+news@example.test");
  for (const value of [null, undefined, 1, "", "a@b.test,c@d.test", "a@b.test,evil", "A <a@b.test>", '"a"@b.test', "a@b.test\r\nBcc:x@y.test", "a@@b.test", "a b@c.test", ".a@b.test", "a..b@c.test"]) {
    expect(() => normalizeAdminEmail(value)).toThrow();
  }
});
it("only returns active accounts, supports legacy casing and fails closed on ambiguous addresses", async () => {
  await fixture.db.user.create({ data: { email: "Legacy@Example.test", accessStatus: "active" } });
  expect((await getApprovedAccount(fixture.db, " legacy@example.test "))?.email).toBe("Legacy@Example.test");
  await fixture.db.user.create({ data: { email: "pending@example.test" } });
  await fixture.db.user.create({ data: { email: "blocked@example.test", accessStatus: "blocked" } });
  for (const email of ["unknown@example.test", "pending@example.test", "blocked@example.test", "bad"]) expect(await getApprovedAccount(fixture.db, email)).toBeNull();
  await fixture.db.user.create({ data: { email: "legacy@example.test", accessStatus: "active" } });
  expect(await getApprovedAccount(fixture.db, "legacy@example.test")).toBeNull();
});
