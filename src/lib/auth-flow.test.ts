import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAuthFixture } from "./auth-test-fixture";

const localMail = vi.hoisted(() => ({ messages: [] as string[] }));
vi.mock("nodemailer", async (original) => {
  const actual = await original<typeof import("nodemailer")>();
  return { ...actual, createTransport: () => {
    const local = actual.createTransport({ jsonTransport: true });
    return { async sendMail(data: Parameters<typeof local.sendMail>[0]) {
      const result = await local.sendMail(data);
      localMail.messages.push(String(result.message));
      return result;
    } };
  } };
});
const nextContext = vi.hoisted(() => ({ headers: new Headers({ host: "localhost:3000" }), cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({ headers: async () => nextContext.headers, cookies: async () => ({
  getAll: () => [...nextContext.cookies].map(([name, value]) => ({ name, value })),
  set: (name: string, value: string) => nextContext.cookies.set(name, value),
}) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let authModule: typeof import("@/auth");
beforeAll(async () => {
  fixture = await createAuthFixture();
  vi.stubEnv("DATABASE_URL", fixture.url);
  vi.stubEnv("AUTH_SECRET", "test-secret-task-three-never-production");
  vi.stubEnv("AUTH_URL", "http://localhost:3000/api/auth");
  vi.stubEnv("AUTH_TRUST_HOST", "true");
  vi.stubEnv("EMAIL_SERVER_HOST", "local-json-transport.invalid");
  vi.stubEnv("EMAIL_SERVER_USER", "test@example.test");
  vi.stubEnv("EMAIL_SERVER_PASSWORD", "test-only");
  vi.stubEnv("EMAIL_FROM", "test@example.test");
  vi.doMock("@/prisma", () => ({ prisma: fixture.db }));
  authModule = await import("@/auth");
}, 30000);
beforeEach(async () => {
  await fixture.reset(); localMail.messages.length = 0; nextContext.cookies.clear();
  nextContext.headers = new Headers({ host: "localhost:3000" });
  vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "");
});
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });

async function requestMail(email: string, extra: Record<string, string> = {}) {
  const csrf = await authModule.handlers.GET(new NextRequest("http://localhost:3000/api/auth/csrf"));
  const { csrfToken } = await csrf.json();
  const cookies = csrf.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  return authModule.handlers.POST(new NextRequest("http://localhost:3000/api/auth/signin/nodemailer", {
    method: "POST", headers: { cookie: cookies, "content-type": "application/x-www-form-urlencoded", ...extra },
    body: new URLSearchParams({ email, csrfToken, callbackUrl: "https://attacker.invalid/" }),
  }));
}

it.each(["unknown", "pending", "blocked"])("never emails or creates credentials for %s addresses through the real Auth endpoint", async (status) => {
  if (status !== "unknown") await fixture.db.user.create({ data: { email: "closed@example.test", accessStatus: status } });
  const response = await requestMail("closed@example.test");
  expect(localMail.messages).toHaveLength(0);
  expect(await fixture.db.verificationToken.count()).toBe(0);
  expect(await fixture.db.user.count()).toBe(status === "unknown" ? 0 : 1);
  expect(response.headers.get("location")).toBe("http://localhost:3000/api/auth/verify-request?provider=nodemailer&type=email");
});

function mailLink(index = localMail.messages.length - 1) {
  const message = JSON.parse(localMail.messages[index]) as { text: string };
  return message.text.match(/http:\/\/localhost:3000\/api\/auth\/callback\/nodemailer\?[^\s]+/)![0];
}
async function activate(email = "active@example.test") {
  return fixture.db.user.create({ data: { email, accessStatus: "active" } });
}
async function revokeAndReactivate(id: string) {
  // Models Task 4's required atomic revoke operation, without implementing its UI.
  await fixture.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { accessStatus: "blocked", accessRevision: { increment: 1 } } });
    await tx.session.deleteMany({ where: { userId: id } });
  });
  await fixture.db.user.update({ where: { id }, data: { accessStatus: "active" } });
}
it("sends one local email, logs in once, forces /admin and spends no quota on callback or auth()", async () => {
  await activate();
  const response = await requestMail(" ACTIVE@EXAMPLE.TEST ");
  expect(response.headers.get("location")).toBe("http://localhost:3000/api/auth/verify-request?provider=nodemailer&type=email");
  expect(localMail.messages).toHaveLength(1);
  const receipt = await authModule.handlers.GET(new NextRequest(response.headers.get("location")!));
  expect(new URL(receipt.headers.get("location")!, "http://localhost:3000").href).toBe("http://localhost:3000/auth/signin?provider=nodemailer&type=email");
  const before = await fixture.db.authRateLimit.count();
  const url = mailLink();
  const callback = await authModule.handlers.GET(new NextRequest(url));
  expect(callback.headers.get("location")).toBe("http://localhost:3000/admin");
  expect(await fixture.db.session.count()).toBe(1);
  expect(await fixture.db.verificationToken.count()).toBe(0);
  const cookies = callback.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  nextContext.headers.set("cookie", cookies);
  expect((await authModule.auth())?.user.email).toBe("active@example.test");
  await authModule.handlers.GET(new NextRequest(url));
  expect(await fixture.db.session.count()).toBe(1);
  expect(await fixture.db.authRateLimit.count()).toBe(before);
});
it("enforces email quota across server signIn and the direct route", async () => {
  await activate();
  const first = await authModule.signIn("nodemailer", { email: "active@example.test", redirect: false, redirectTo: "https://attacker.invalid" });
  expect(first).toBe("http://localhost:3000/api/auth/verify-request?provider=nodemailer&type=email");
  const second = await requestMail("ACTIVE@example.test");
  expect(second.headers.get("location")).toBe(first);
  expect(localMail.messages).toHaveLength(1);
  expect(await fixture.db.verificationToken.count()).toBe(1);
});
it("enforces five emails per hour through server signIn even when each minute has elapsed", async () => {
  await activate();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now");
  try {
    for (let i = 0; i < 6; i++) {
      clock.mockReturnValue(now + i * 60000);
      await authModule.signIn("nodemailer", { email: "active@example.test", redirect: false });
    }
    expect(localMail.messages).toHaveLength(5);
    clock.mockReturnValue(now + 3600000);
    await authModule.signIn("nodemailer", { email: "active@example.test", redirect: false });
    expect(localMail.messages).toHaveLength(6);
  } finally { clock.mockRestore(); }
});
it("rejects invalid and unapproved addresses neutrally through server signIn as well", async () => {
  for (const email of ["no@example.test", "one@example.test,two@example.test", ""]) {
    const url = await authModule.signIn("nodemailer", { email, redirect: false });
    expect(url).toBe("http://localhost:3000/api/auth/verify-request?provider=nodemailer&type=email");
  }
  expect(localMail.messages).toHaveLength(0);
  expect(await fixture.db.user.count()).toBe(0);
  expect(await fixture.db.verificationToken.count()).toBe(0);
});
it("keeps direct endpoint CSRF protection", async () => {
  await activate();
  const response = await authModule.handlers.POST(new NextRequest("http://localhost:3000/api/auth/signin/nodemailer", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: "active@example.test" }),
  }));
  expect(response.headers.get("location")).toContain("MissingCSRF");
  expect(localMail.messages).toHaveLength(0);
  expect(await fixture.db.verificationToken.count()).toBe(0);
});
it("does not allow forged forwarded headers to evade the shared 30 request quota", async () => {
  await activate();
  for (let i = 0; i < 30; i++) await requestMail(`unknown-${i}@example.test`, { "x-forwarded-for": `192.0.2.${i + 1}`, forwarded: `for=192.0.2.${i + 1}` });
  const response = await requestMail("active@example.test", { "x-forwarded-for": "203.0.113.1" });
  expect(response.headers.get("location")).toBe("http://localhost:3000/api/auth/verify-request?provider=nodemailer&type=email");
  expect(localMail.messages).toHaveLength(0);
  // Direct server calls must consume that very same fallback quota.
  await authModule.signIn("nodemailer", { email: "active@example.test", redirect: false });
  expect(localMail.messages).toHaveLength(0);
});
it("uses next/headers for trusted server-action IPs, isolated from the unknown-IP quota", async () => {
  vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-proxy-client-ip");
  await activate();
  for (let i = 0; i < 30; i++) await requestMail(`unknown-${i}@example.test`);
  nextContext.headers.set("x-proxy-client-ip", "192.0.2.10");
  await authModule.signIn("nodemailer", { email: "active@example.test", redirect: false });
  expect(localMail.messages).toHaveLength(1);
});
it("allows only one email across twenty concurrent real requests", async () => {
  await activate();
  await Promise.all(Array.from({ length: 20 }, () => requestMail("active@example.test")));
  expect(localMail.messages).toHaveLength(1);
  expect(await fixture.db.verificationToken.count()).toBe(1);
}, 30000);
it("rejects a revoked link after unblock and accepts a fresh link, then session revocation removes it", async () => {
  const user = await activate();
  await requestMail("active@example.test");
  const old = mailLink();
  await revokeAndReactivate(user.id);
  await authModule.handlers.GET(new NextRequest(old));
  expect(await fixture.db.session.count()).toBe(0);
  // Advance only the quota clock; actual link expiry remains in the future.
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
  try { await requestMail("active@example.test"); } finally { clock.mockRestore(); }
  await authModule.handlers.GET(new NextRequest(mailLink()));
  expect(await fixture.db.session.count()).toBe(1);
  await revokeAndReactivate(user.id);
  expect(await fixture.db.session.count()).toBe(0);
});
it.each(["authorization", "session"])("rejects a real core attempt paused at %s before session creation", async (pauseAt) => {
  const user = await activate();
  await requestMail("active@example.test");
  const { createAuthConfig } = await import("./auth-config.server");
  const { Auth } = await import("@auth/core");
  const config = createAuthConfig(fixture.db, new Headers());
  const authorize = config.callbacks!.signIn!;
  const createSession = config.adapter!.createSession!;
  let reached!: () => void, resume!: () => void;
  const reachedCallback = new Promise<void>((resolve) => { reached = resolve; });
  const resumeCallback = new Promise<void>((resolve) => { resume = resolve; });
  if (pauseAt === "authorization") config.callbacks!.signIn = async (params) => {
      const result = await authorize(params);
      reached(); await resumeCallback;
      return result;
    };
  else config.adapter!.createSession = async (data) => {
      reached(); await resumeCallback;
      return createSession(data);
    };
  const pending = Auth(new Request(mailLink()), { ...config, basePath: "/api/auth", trustHost: true });
  await reachedCallback;
  await revokeAndReactivate(user.id);
  resume();
  await pending;
  expect(await fixture.db.session.count()).toBe(0);
});
it("allows only one successful callback when the same link is used concurrently", async () => {
  await activate();
  await requestMail("active@example.test");
  const url = mailLink();
  await Promise.all([authModule.handlers.GET(new NextRequest(url)), authModule.handlers.GET(new NextRequest(url))]);
  expect(await fixture.db.session.count()).toBe(1);
  expect(await fixture.db.verificationToken.count()).toBe(0);
});
