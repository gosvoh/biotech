import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createAuthFixture } from "@/lib/auth-test-fixture";

// Only the SMTP transport is replaced. Auth.js, quota, token adapter and session
// lookup execute unchanged against the newly-created fixture database.
const mail = vi.hoisted(() => ({ messages: [] as { to: { address: string }[]; text: string }[], failFor: "" }));
vi.mock("nodemailer", async (original) => {
  const actual = await original<typeof import("nodemailer")>();
  return { ...actual, createTransport: () => {
    const transport = actual.createTransport({ jsonTransport: true });
    return { async sendMail(data: Parameters<typeof transport.sendMail>[0]) {
      if (String(data.to) === mail.failFor) throw new Error("Test SMTP rejection");
      const result = await transport.sendMail(data);
      mail.messages.push(JSON.parse(String(result.message)));
      return result;
    } };
  } };
});
const context = vi.hoisted(() => ({ headers: new Headers({ host: "localhost:3000" }), cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers, cookies: async () => ({
  getAll: () => [...context.cookies].map(([name, value]) => ({ name, value })),
  set: (name: string, value: string) => context.cookies.set(name, value),
}) }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let actions: typeof import("./actions");
let actor: string;
beforeAll(async () => {
  fixture = await createAuthFixture();
  vi.stubEnv("DATABASE_URL", fixture.url);
  vi.stubEnv("AUTH_SECRET", "test-secret-task-four-never-production");
  vi.stubEnv("AUTH_URL", "http://localhost:3000/api/auth");
  vi.stubEnv("AUTH_TRUST_HOST", "true");
  vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "");
  vi.stubEnv("EMAIL_SERVER_HOST", "local-json-transport.invalid");
  vi.stubEnv("EMAIL_SERVER_USER", "test@example.test");
  vi.stubEnv("EMAIL_SERVER_PASSWORD", "test-only");
  vi.stubEnv("EMAIL_FROM", "test@example.test");
  vi.doMock("@/prisma", () => ({ prisma: fixture.db }));
  actions = await import("./actions");
}, 30000);
beforeEach(async () => {
  await fixture.reset(); mail.messages.length = 0; mail.failFor = ""; context.cookies.clear();
  actor = (await fixture.db.user.create({ data: { email: "admin@example.test", role: "admin", accessStatus: "active" } })).id;
  await fixture.db.session.create({ data: { userId: actor, sessionToken: "admin-session", expires: new Date(Date.now() + 60000) } });
  context.headers = new Headers({ host: "localhost:3000", cookie: "authjs.session-token=admin-session" });
});
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
const input = { email: "editor@example.test", role: "user", sections: ["news"] };
async function target(email: string | null = "editor@example.test", accessStatus = "active") {
  return fixture.db.user.create({ data: { email, accessStatus } });
}

it("creates and saves rights using the real session actor without sending any mail", async () => {
  const result = await actions.createUser(input);
  expect(result).toMatchObject({ ok: true, data: { role: "user", sections: ["news"] } });
  if (!result.ok) throw new Error("create failed");
  expect(await actions.updateUserAccess(result.data.userId, { role: "user", sections: ["members"] })).toMatchObject({ ok: true });
  expect(mail.messages).toHaveLength(0);
  expect(await fixture.db.authRateLimit.count()).toBe(0);
});
it("rejects forged actor/role/sections and read-only email edits as ActionResult", async () => {
  for (const data of [{ ...input, actorId: actor }, { ...input, role: "owner" }, { ...input, sections: ["users"] }]) {
    expect(await actions.createUser(data)).toMatchObject({ ok: false });
  }
  const user = await target();
  expect(await actions.updateUserAccess(user.id, { role: "admin", sections: [], email: "changed@example.test" })).toMatchObject({ ok: false });
  expect(await actions.setUserBlocked(user.id, "false")).toMatchObject({ ok: false });
  expect(await actions.deleteUser({ id: user.id })).toMatchObject({ ok: false });
  expect(await fixture.db.user.findUnique({ where: { id: user.id } })).toMatchObject({ role: "user", email: "editor@example.test", accessStatus: "active" });
});
it.each(["anonymous", "editor", "blocked", "missing"])("refuses every action for a %s actor and cannot be bypassed with the development flag", async (kind) => {
  const user = await target();
  if (kind === "anonymous") context.headers.delete("cookie");
  if (kind === "missing") await fixture.db.user.delete({ where: { id: actor } });
  if (kind === "editor") await fixture.db.user.update({ where: { id: actor }, data: { role: "user" } });
  if (kind === "blocked") await fixture.db.user.update({ where: { id: actor }, data: { accessStatus: "blocked" } });
  vi.stubEnv("DISABLE_ADMIN_AUTH", "true");
  try {
    expect(await actions.createUser(input)).toMatchObject({ ok: false });
    expect(await actions.updateUserAccess(user.id, { role: "admin", sections: [] })).toMatchObject({ ok: false });
    expect(await actions.changeRole(user.id, "admin")).toMatchObject({ ok: false });
    expect(await actions.setUserBlocked(user.id, true)).toMatchObject({ ok: false });
    expect(await actions.deleteUser(user.id)).toMatchObject({ ok: false });
    expect(await actions.sendUserInvitation(user.id)).toMatchObject({ ok: false });
    expect(await fixture.db.user.findUnique({ where: { id: user.id } })).toMatchObject({ role: "user", accessStatus: "active" });
    expect(mail.messages).toHaveLength(0);
  } finally { vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); }
});
it("routes legacy role/delete controls through self restrictions and preserves target grants", async () => {
  expect(await actions.changeRole(actor, "user")).toMatchObject({ ok: false });
  expect(await actions.deleteUser(actor)).toMatchObject({ ok: false });
  expect(await actions.setUserBlocked(actor, true)).toMatchObject({ ok: false });
  const user = await target();
  await fixture.db.userSectionPermission.create({ data: { userId: user.id, section: "news" } });
  expect(await actions.changeRole(user.id, "admin")).toMatchObject({ ok: true });
  expect(await actions.changeRole(user.id, "user")).toMatchObject({ ok: true });
  expect(await fixture.db.userSectionPermission.findMany({ where: { userId: user.id } })).toMatchObject([{ section: "news" }]);
});
it("reports actual delivery, then an explicit quota error despite Auth.js's identical neutral redirect", async () => {
  const user = await target();
  expect(await actions.sendUserInvitation(user.id)).toMatchObject({ ok: true });
  expect(mail.messages).toMatchObject([{ to: [{ address: "editor@example.test" }] }]);
  expect(await fixture.db.verificationToken.count()).toBe(1);
  expect(await actions.sendUserInvitation(user.id)).toMatchObject({ ok: false, error: expect.stringMatching(/лимит/i) });
  expect(mail.messages).toHaveLength(1);
  expect((await fixture.db.authRateLimit.findMany()).map((row) => row.count)).toEqual([1, 1, 1, 1]);
});
it("reports SMTP failure without reporting success or creating a second mail/token pipeline", async () => {
  const user = await target(); mail.failFor = "editor@example.test";
  expect(await actions.sendUserInvitation(user.id)).toMatchObject({ ok: false, error: expect.stringMatching(/отправ/i) });
  expect(mail.messages).toHaveLength(0);
  // Auth core intentionally stores the token concurrently with SMTP.
  expect(await fixture.db.verificationToken.count()).toBe(1);
  expect((await fixture.db.authRateLimit.findMany()).map((row) => row.count)).toEqual([1, 1, 1]);
});
it.each([null, "pending", "blocked"])("rejects invitation for unavailable saved identity %s before quota/mail", async (status) => {
  const user = await target(status === null ? null : "editor@example.test", status ?? "active");
  expect(await actions.sendUserInvitation(user.id)).toMatchObject({ ok: false });
  expect(mail.messages).toHaveLength(0);
  expect(await fixture.db.authRateLimit.count()).toBe(0);
});
it("isolates trusted delivery observations between concurrent invitations", async () => {
  const good = await target("good@example.test");
  const bad = await target("bad@example.test"); mail.failFor = "bad@example.test";
  const [sent, failed] = await Promise.all([actions.sendUserInvitation(good.id), actions.sendUserInvitation(bad.id)]);
  expect(sent).toMatchObject({ ok: true });
  expect(failed).toMatchObject({ ok: false });
  expect(mail.messages).toHaveLength(1);
});
