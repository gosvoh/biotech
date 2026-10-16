import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createApprovedAuthAdapter, createAuthAttemptContext } from "./auth-adapter";
import { createAuthFixture } from "./auth-test-fixture";
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
beforeAll(async () => { fixture = await createAuthFixture(); }, 30000);
beforeEach(async () => { await fixture.reset(); });
afterAll(async () => { await fixture?.close(); });
const expires = new Date("2099-01-01");
it("forbids spontaneous registration even when called directly", async () => {
  const adapter = createApprovedAuthAdapter(fixture.db, createAuthAttemptContext());
  await expect(adapter.createUser!({ id: "attacker", email: "new@example.test", emailVerified: null, role: "user" })).rejects.toThrow();
  expect(await fixture.db.user.count()).toBe(0);
});
it("pins token issuance to the approved revision and never copies a newer revision", async () => {
  const user = await fixture.db.user.create({ data: { email: "active@example.test", accessStatus: "active" } });
  const context = createAuthAttemptContext();
  context.issuance = { userId: user.id, email: user.email!, revision: 0 };
  const adapter = createApprovedAuthAdapter(fixture.db, context);
  await adapter.createVerificationToken!({ identifier: user.email!, token: "first", expires });
  expect(await fixture.db.verificationToken.findFirst()).toMatchObject({ accessRevision: 0 });
  await fixture.db.user.update({ where: { id: user.id }, data: { accessRevision: 2 } });
  await expect(adapter.createVerificationToken!({ identifier: user.email!, token: "stale", expires })).rejects.toThrow();
  expect(await fixture.db.verificationToken.count()).toBe(1);
});
it.each(["revision", "blocked", "deleted"])("rejects session creation after %s change between token consumption and session", async (change) => {
  const user = await fixture.db.user.create({ data: { email: "active@example.test", accessStatus: "active" } });
  await fixture.db.verificationToken.create({ data: { identifier: user.email!, token: "legacy", expires } });
  const context = createAuthAttemptContext();
  const adapter = createApprovedAuthAdapter(fixture.db, context);
  expect(await adapter.useVerificationToken!({ identifier: user.email!, token: "legacy" })).not.toBeNull();
  if (change === "deleted") await fixture.db.user.delete({ where: { id: user.id } });
  else await fixture.db.user.update({ where: { id: user.id }, data: change === "blocked" ? { accessStatus: "blocked" } : { accessRevision: 2 } });
  await expect(adapter.createSession!({ userId: user.id, sessionToken: "stale-session", expires })).rejects.toThrow();
  expect(await fixture.db.session.count()).toBe(0);
});
it("keeps attempt contexts isolated and accepts a legacy revision-zero link only once", async () => {
  const user = await fixture.db.user.create({ data: { email: "active@example.test", accessStatus: "active" } });
  await fixture.db.verificationToken.create({ data: { identifier: user.email!, token: "legacy", expires } });
  const first = createApprovedAuthAdapter(fixture.db, createAuthAttemptContext());
  const second = createApprovedAuthAdapter(fixture.db, createAuthAttemptContext());
  expect(await first.useVerificationToken!({ identifier: user.email!, token: "legacy" })).not.toBeNull();
  await expect(second.createSession!({ userId: user.id, sessionToken: "other", expires })).rejects.toThrow();
  expect(await first.createSession!({ userId: user.id, sessionToken: "valid", expires })).toMatchObject({ userId: user.id });
  expect(await second.useVerificationToken!({ identifier: user.email!, token: "legacy" })).toBeNull();
});
it("never transfers a consumed legacy token to an account recreated during the consume result await", async () => {
  const original = await fixture.db.user.create({ data: { email: "reused@example.test", accessStatus: "active" } });
  await fixture.db.verificationToken.create({ data: { identifier: original.email!, token: "legacy-reused", expires } });
  let consumed!: () => void, resume!: () => void;
  const tokenDeleted = new Promise<void>((resolve) => { consumed = resolve; });
  const resumeConsumption = new Promise<void>((resolve) => { resume = resolve; });
  const query = fixture.db.$queryRaw.bind(fixture.db);
  const intercepted = vi.spyOn(fixture.db, "$queryRaw").mockImplementation((...args) => {
    const pending = query(...args);
    if (!String(args[0]).includes("DELETE FROM VerificationToken")) return pending;
    return new Proxy(pending, {
      get(target, property, receiver) {
        if (property === "then") return (...callbacks: Parameters<typeof pending.then>) => target.then(async (result) => {
          consumed(); await resumeConsumption;
          return result;
        }).then(...callbacks);
        return Reflect.get(target, property, receiver);
      },
    });
  });
  const context = createAuthAttemptContext();
  const adapter = createApprovedAuthAdapter(fixture.db, context);
  const pending = adapter.useVerificationToken!({ identifier: original.email!, token: "legacy-reused" });
  try {
    await tokenDeleted;
    expect(await fixture.db.verificationToken.count()).toBe(0);
    await fixture.db.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: original.id } });
      await tx.verificationToken.deleteMany({ where: { identifier: original.email! } });
    });
    const replacement = await fixture.db.user.create({ data: { email: original.email, accessStatus: "active", role: "admin" } });
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.accessRevision).toBe(0);
    resume();
    await pending;
    // Preserve PrismaPromise semantics for the session batch transaction.
    intercepted.mockRestore();
    await expect(adapter.createSession!({ userId: replacement.id, sessionToken: "replacement-session", expires })).rejects.toThrow();
    expect(await fixture.db.session.count()).toBe(0);
  } finally {
    resume();
    await pending;
    intercepted.mockRestore();
  }
});
