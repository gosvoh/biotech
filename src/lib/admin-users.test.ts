import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createAuthFixture } from "./auth-test-fixture";
import { createAuthTestClient } from "./auth-test-client";
import { createAdminUser, updateAdminUserAccess, setAdminUserBlocked, deleteAdminUser } from "./admin-users";

let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let actor: string;
beforeAll(async () => { fixture = await createAuthFixture(); }, 30000);
beforeEach(async () => {
  await fixture.reset();
  actor = (await fixture.db.user.create({ data: { email: "admin@example.test", role: "admin", accessStatus: "active" } })).id;
});
afterAll(async () => { await fixture?.close(); });
const input = { email: " Editor@Example.Test ", role: "user" as const, sections: ["news" as const] };

it("creates an active, unverified canonical account with explicit grants without issuing credentials", async () => {
  const result = await createAdminUser(fixture.db, actor, input);
  expect(result).toEqual({ userId: expect.any(String), role: "user", status: "active", sections: ["news"] });
  expect(await fixture.db.user.findUnique({ where: { id: result.userId } })).toMatchObject({ email: "editor@example.test", emailVerified: null });
  expect(await fixture.db.verificationToken.count()).toBe(0);
  expect(await fixture.db.authRateLimit.count()).toBe(0);
});
it.each(["editor", "blocked", "missing"])("rejects every operation for a %s actor without side effects", async (kind) => {
  if (kind === "missing") await fixture.db.user.delete({ where: { id: actor } });
  else await fixture.db.user.update({ where: { id: actor }, data: kind === "editor" ? { role: "user" } : { accessStatus: "blocked" } });
  const target = await fixture.db.user.create({ data: { email: "target@example.test", accessStatus: "active" } });
  await expect(createAdminUser(fixture.db, actor, input)).rejects.toThrow();
  await expect(updateAdminUserAccess(fixture.db, actor, target.id, { role: "admin", sections: [] })).rejects.toThrow();
  await expect(setAdminUserBlocked(fixture.db, actor, target.id, true)).rejects.toThrow();
  await expect(deleteAdminUser(fixture.db, actor, target.id)).rejects.toThrow();
  expect(await fixture.db.user.findUnique({ where: { id: target.id } })).toMatchObject({ role: "user", accessStatus: "active" });
});
it.each([
  { ...input, role: "owner" }, { ...input, sections: ["users"] },
  { ...input, actorId: "forged" }, { ...input, sections: ["news", "news"] },
  { ...input, email: "a@example.test,b@example.test" },
])("rejects malformed and extra privilege input", async (data) => {
  await expect(createAdminUser(fixture.db, actor, data)).rejects.toThrow();
  expect(await fixture.db.user.count()).toBe(1);
});
it("rejects a normalized legacy duplicate without changing the existing user's rights", async () => {
  const old = await fixture.db.user.create({ data: { email: " EDITOR@example.test ", accessStatus: "pending" } });
  await expect(createAdminUser(fixture.db, actor, { ...input, role: "admin" })).rejects.toThrow();
  expect(await fixture.db.user.findUnique({ where: { id: old.id } })).toMatchObject({ role: "user", accessStatus: "pending" });
  expect(await fixture.db.user.count()).toBe(2);
});
it("clears unconsumed legacy tokens when creating an absent canonical address and preserves other addresses", async () => {
  await fixture.db.verificationToken.createMany({ data: [
    { identifier: " EDITOR@EXAMPLE.TEST ", token: "orphan", expires: new Date(Date.now() + 60000) },
    { identifier: "other@example.test", token: "other", expires: new Date(Date.now() + 60000) },
  ] });
  await createAdminUser(fixture.db, actor, input);
  expect((await fixture.db.verificationToken.findMany()).map((row) => row.token)).toEqual(["other"]);
});
it("retains sessions/revision during rights-only edits, persists chosen editor grants after demotion, and refuses email edits", async () => {
  const target = await createAdminUser(fixture.db, actor, { ...input, role: "admin" });
  await fixture.db.session.create({ data: { userId: target.userId, sessionToken: "retained", expires: new Date(Date.now() + 60000) } });
  const access = await updateAdminUserAccess(fixture.db, actor, target.userId, { role: "user", sections: ["publications", "members"] });
  expect(access).toMatchObject({ role: "user", sections: ["members", "publications"] });
  expect(await fixture.db.session.count()).toBe(1);
  expect(await fixture.db.user.findUnique({ where: { id: target.userId } })).toMatchObject({ email: "editor@example.test", accessRevision: 0 });
  await expect(updateAdminUserAccess(fixture.db, actor, target.userId, { role: "user", sections: [], email: "new@example.test" })).rejects.toThrow();
});
it("blocks atomically, revokes sessions and normalized tokens, retains grants; unblock never restores credentials", async () => {
  const target = await createAdminUser(fixture.db, actor, input);
  await fixture.db.session.create({ data: { userId: target.userId, sessionToken: "revoked", expires: new Date(Date.now() + 60000) } });
  await fixture.db.verificationToken.create({ data: { identifier: " EDITOR@EXAMPLE.TEST ", token: "revoked", expires: new Date(Date.now() + 60000) } });
  await setAdminUserBlocked(fixture.db, actor, target.userId, true);
  expect(await fixture.db.user.findUnique({ where: { id: target.userId } })).toMatchObject({ accessStatus: "blocked", accessRevision: 1 });
  expect(await fixture.db.session.count()).toBe(0);
  expect(await fixture.db.verificationToken.count()).toBe(0);
  expect(await fixture.db.userSectionPermission.count()).toBe(1);
  await setAdminUserBlocked(fixture.db, actor, target.userId, false);
  expect(await fixture.db.user.findUnique({ where: { id: target.userId } })).toMatchObject({ accessStatus: "active", accessRevision: 1 });
  expect(await fixture.db.session.count()).toBe(0);
  expect(await fixture.db.verificationToken.count()).toBe(0);
});
it("deletes account/session/grants/normalized tokens and recreation cannot inherit the link", async () => {
  const target = await createAdminUser(fixture.db, actor, input);
  await fixture.db.account.create({ data: { userId: target.userId, type: "oauth", provider: "test", providerAccountId: "test" } });
  await fixture.db.session.create({ data: { userId: target.userId, sessionToken: "old", expires: new Date(Date.now() + 60000) } });
  await fixture.db.verificationToken.create({ data: { identifier: "EDITOR@EXAMPLE.TEST", token: "old", expires: new Date(Date.now() + 60000) } });
  await deleteAdminUser(fixture.db, actor, target.userId);
  expect(await fixture.db.account.count()).toBe(0);
  expect(await fixture.db.session.count()).toBe(0);
  expect(await fixture.db.userSectionPermission.count()).toBe(0);
  const replacement = await createAdminUser(fixture.db, actor, input);
  expect(replacement.userId).not.toBe(target.userId);
  expect(await fixture.db.verificationToken.count()).toBe(0);
});
it("prohibits self-demotion, self-blocking and self-deletion even for the sole admin", async () => {
  await expect(updateAdminUserAccess(fixture.db, actor, actor, { role: "user", sections: [] })).rejects.toThrow();
  await expect(setAdminUserBlocked(fixture.db, actor, actor, true)).rejects.toThrow();
  await expect(deleteAdminUser(fixture.db, actor, actor)).rejects.toThrow();
  expect(await fixture.db.user.count({ where: { role: "admin", accessStatus: "active" } })).toBe(1);
});
it.each(["demote", "block", "delete"])("serializes mutual concurrent %s with fresh actor checks on separate SQLite clients", async (operation) => {
  const peer = (await fixture.db.user.create({ data: { email: "peer@example.test", role: "admin", accessStatus: "active" } })).id;
  const second = createAuthTestClient(fixture.url);
  const act = (db: typeof fixture.db, from: string, to: string) => operation === "demote"
    ? updateAdminUserAccess(db, from, to, { role: "user", sections: [] })
    : operation === "block" ? setAdminUserBlocked(db, from, to, true) : deleteAdminUser(db, from, to);
  try {
    const result = await Promise.allSettled([act(fixture.db, actor, peer), act(second, peer, actor)]);
    expect(result.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(await fixture.db.user.count({ where: { role: "admin", accessStatus: "active" } })).toBe(1);
  } finally { await second.$disconnect(); }
}, 30000);

it.each(["create", "block", "delete"])("rolls back every %s side effect if token cleanup fails", async (operation) => {
  const target = operation === "create" ? null : await createAdminUser(fixture.db, actor, input);
  if (target) await fixture.db.session.create({ data: { userId: target.userId, sessionToken: "keep-on-failure", expires: new Date(Date.now() + 60000) } });
  await fixture.db.verificationToken.create({ data: { identifier: "editor@example.test", token: "keep-on-failure", expires: new Date(Date.now() + 60000) } });
  await fixture.db.$executeRawUnsafe("CREATE TRIGGER reject_token_cleanup BEFORE DELETE ON VerificationToken BEGIN SELECT RAISE(ABORT, 'fixture token cleanup failure'); END");
  try {
    const operationResult = operation === "create" ? createAdminUser(fixture.db, actor, input)
      : operation === "block" ? setAdminUserBlocked(fixture.db, actor, target!.userId, true)
      : deleteAdminUser(fixture.db, actor, target!.userId);
    await expect(operationResult).rejects.toThrow();
    if (target) {
      expect(await fixture.db.user.findUnique({ where: { id: target.userId } })).toMatchObject({ accessStatus: "active", accessRevision: 0 });
      expect(await fixture.db.session.count()).toBe(1);
      expect(await fixture.db.userSectionPermission.count()).toBe(1);
    } else expect(await fixture.db.user.count()).toBe(1);
    expect(await fixture.db.verificationToken.count()).toBe(1);
  } finally { await fixture.db.$executeRawUnsafe("DROP TRIGGER reject_token_cleanup"); }
});
it("allows only one concurrent create for a normalized address", async () => {
  const second = createAuthTestClient(fixture.url);
  try {
    const results = await Promise.allSettled([
      createAdminUser(fixture.db, actor, input), createAdminUser(second, actor, { ...input, email: "EDITOR@example.test" }),
    ]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(await fixture.db.user.count()).toBe(2);
  } finally { await second.$disconnect(); }
});
it("retains accepted VK jobs, queue leases and automatic schedule across all user operations", async () => {
  await fixture.db.vkImportSource.create({ data: { groupId: "task4-fixture", name: "Local fixture", screenName: "fixture", autoEnabled: true, nextNewAt: new Date("2026-10-17T00:00:00Z") } });
  await fixture.db.vkHistoryJob.create({ data: { id: "task4-job", groupId: "task4-fixture", from: "2026-09-01", to: "2026-10-01", state: "queued" } });
  await fixture.db.vkAutomationRuntime.create({ data: { id: 1, currentGroupId: "task4-fixture", leaseToken: "fixture-lease" } });
  const snapshot = async () => ({
    source: await fixture.db.vkImportSource.findMany(), jobs: await fixture.db.vkHistoryJob.findMany(), runtime: await fixture.db.vkAutomationRuntime.findMany(),
  });
  const before = await snapshot();
  try {
    const target = await createAdminUser(fixture.db, actor, input);
    await updateAdminUserAccess(fixture.db, actor, target.userId, { role: "admin", sections: ["members"] });
    await setAdminUserBlocked(fixture.db, actor, target.userId, true);
    await setAdminUserBlocked(fixture.db, actor, target.userId, false);
    await deleteAdminUser(fixture.db, actor, target.userId);
    expect(await snapshot()).toEqual(before);
  } finally {
    await fixture.db.vkHistoryJob.deleteMany(); await fixture.db.vkImportSource.deleteMany(); await fixture.db.vkAutomationRuntime.deleteMany();
  }
});
