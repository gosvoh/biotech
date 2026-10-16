import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { createAuthFixture } from "./auth-test-fixture";
import { ADMIN_SECTIONS, type AdminSection } from "./admin-access";
const context = vi.hoisted(() => ({ id: null as string | null, reads: [] as string[], effects: [] as string[] }));
vi.mock("@/auth", () => ({ auth: async () => context.id ? { user: { id: context.id, role: "admin" } } : null, signIn: async () => { throw new Error("SIGNIN"); } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ cacheLife() {}, cacheTag() {}, revalidateTag: () => context.effects.push("cache") }));
vi.mock("fs/promises", async original => ({ ...await original<typeof import("fs/promises")>(), default: { mkdir: async () => { context.effects.push("mkdir"); }, unlink: async () => { context.effects.push("unlink"); }, copyFile: async () => { context.effects.push("copyFile"); } } }));
vi.mock("@/app/admin/members/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/disciplines/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/scientific-works/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/news/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/news/[id]/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/tags/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/publications/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/users/page.client", () => ({ default: () => null }));
vi.mock("@/app/admin/news/import-panel", () => ({ default: () => null }));
vi.mock("@/app/admin/news/history-panel", () => ({ default: () => null }));
vi.mock("@/app/admin/news/vk-exclusions", () => ({ default: () => null }));
let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
type Mutation = { name: string; section: AdminSection | "users"; call: () => Promise<unknown> };
const mutations: Mutation[] = [];
const pages: { name: string; section: AdminSection | "users"; call: () => Promise<unknown> }[] = [];
const coveredExports: Record<string, string[]> = {};
const modules = [
  ["members/actions", "members", { reorderMembers: [null], addMember: [new FormData()], updateMember: [new FormData()], deleteMember: ["absent"], duplicateMember: ["absent"] }],
  ["disciplines/actions", "disciplines", { addDiscipline: ["New"], updateDiscipline: [{ id: "absent", title: "New" }], deleteDiscipline: ["absent"] }],
  ["scientific-works/actions", "scientific-works", { addScientificWork: ["New"], updateScientificWork: [{ id: "absent", title: "New" }], deleteScientificWork: ["absent"] }],
  ["publications/actions", "publications", { createPublication: [{}], updatePublication: [{}], deletePublication: ["absent"] }],
  ["tags/actions", "news", { addNewsTags: ["New"], updateNewsTags: [{ id: "absent", title: "New" }], deleteNewsTags: ["absent"] }],
  ["news/actions", "news", { deleteNews: ["absent"], changeVisibility: ["absent", true], duplicateNews: ["absent"] }],
  ["news/[id]/actions", "news", { addNews: [new FormData()], updateNews: [new FormData()] }],
  ["news/import-actions", "news", { checkVkNews: [], recheckVkNewsTags: [] }],
  ["news/history-actions", "news", { queueVkNewsHistory: ["2026-09-01", "2026-09-02"], continueVkNewsHistory: ["absent"], getVkNewsHistoryDetails: [{ jobId: "absent", page: 1, filter: "all" }] }],
  ["news/automation-actions", "news", { setVkNewsAutomation: [true, null, null] }],
  ["news/vk-actions", "news", { checkVkNewsPost: ["absent"], enableVkNewsSync: ["absent"], disableVkNewsSync: ["absent"], restoreVkNewsPost: ["42", "1"] }],
  ["users/actions", "users", { createUser: [{ email: "new@example.test", role: "user", sections: [] }], updateUserAccess: ["absent", { role: "user", sections: [] }], changeRole: ["absent", "user"], setUserBlocked: ["absent", true], deleteUser: ["absent"], sendUserInvitation: ["absent"] }],
] as const;
beforeAll(async () => {
  fixture = await createAuthFixture();
  // A database middleware observes protected reads/writes; real domain functions remain active.
  const observedDb = fixture.db.$extends({ query: { $allOperations({ model, operation, args, query }) {
    if (model && (!["User", "Session", "UserSectionPermission"].includes(model) || (model === "User" && operation === "findMany"))) context.reads.push(`${model}.${operation}`);
    return query(args);
  } } });
  vi.doMock("@/prisma", () => ({ prisma: observedDb }));
  for (const [path, section, args] of modules) {
    const actions = await import(/* @vite-ignore */ `../app/admin/${path}.ts`) as Record<string, (...args: unknown[]) => Promise<unknown>>;
    coveredExports[path] = Object.keys(actions).sort();
    for (const [name, values] of Object.entries(args)) mutations.push({ name, section, call: () => actions[name](...values) });
  }
  for (const [path, section] of [["members", "members"], ["disciplines", "disciplines"], ["scientific-works", "scientific-works"], ["news", "news"], ["news/[id]", "news"], ["tags", "news"], ["publications", "publications"], ["users", "users"]] as const) {
    const page = await import(/* @vite-ignore */ `../app/admin/${path}/page.tsx`);
    pages.push({ name: path, section, call: () => page.default({ params: Promise.resolve({ id: "new" }) }) });
  }
}, 30000);
beforeEach(async () => {
  await fixture.reset(); context.id = null; context.effects = []; context.reads = [];
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false"); vi.stubEnv("VK_GROUP_TOKEN", ""); vi.stubEnv("VK_GROUP_ID", "");
  vi.stubGlobal("fetch", async () => { context.effects.push("fetch"); throw new Error("NETWORK_FORBIDDEN"); });
});
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function account(status: string, role: string, section?: string) {
  const user = await fixture.db.user.create({ data: { accessStatus: status, role, sectionPermissions: section ? { create: { section } } : undefined } });
  context.id = user.id;
}
it("covers every exported mutation in all seven sections and VK action modules", () => {
  for (const [path, , args] of modules) expect(coveredExports[path]).toEqual(Object.keys(args).sort());
});
it.each(["anonymous", "pending", "blocked", "no-grants", ...ADMIN_SECTIONS.map(s => s.code)])("rejects every unavailable action/page before protected reads or side effects for %s", async identity => {
  if (identity !== "anonymous") await account(["pending", "blocked"].includes(identity) ? identity : "active", identity === "blocked" ? "admin" : "user", identity);
  for (const action of mutations) {
    if (action.section === identity) continue;
    context.reads = []; context.effects = [];
    const result = await action.call();
    expect(result, action.name).toMatchObject({ ok: false, error: expect.stringMatching(/прав|вход|администратор/i) });
    expect(context.reads, action.name).toEqual([]);
    expect(context.effects, action.name).toEqual([]);
  }
  for (const page of pages) {
    if (page.section === identity) continue;
    context.reads = []; context.effects = [];
    await expect(page.call(), page.name).rejects.toThrow(identity === "anonymous" ? "SIGNIN" : "REDIRECT:/admin/forbidden");
    expect(context.reads, page.name).toEqual([]); expect(context.effects, page.name).toEqual([]);
  }
});
it("members editors can read existing dictionaries but cannot create or edit them", async () => {
  await account("active", "user", "members");
  await expect(pages.find(p => p.name === "members")!.call()).resolves.toBeDefined();
  expect(context.reads).toContain("Discipline.findMany"); expect(context.reads).toContain("ScientificWork.findMany");
  expect(await mutations.find(m => m.name === "addDiscipline")!.call()).toMatchObject({ ok: false });
  expect(await mutations.find(m => m.name === "addScientificWork")!.call()).toMatchObject({ ok: false });
  expect(await fixture.db.discipline.count()).toBe(0); expect(await fixture.db.scientificWork.count()).toBe(0);
});
it.each(["members", "disciplines", "scientific-works", "news", "publications"])("permits a %s editor's actual section mutation with a stale session role", async section => {
  await account("active", "user", section);
  const name = { members: "reorderMembers", disciplines: "addDiscipline", "scientific-works": "addScientificWork", news: "addNewsTags", publications: "createPublication" }[section]!;
  const result = await mutations.find(m => m.name === name)!.call();
  // Payload validation errors are allowed here; authorization must have succeeded.
  expect(JSON.stringify(result)).not.toMatch(/Недостаточно прав|Unauthorized/);
  if (["addDiscipline", "addScientificWork", "addNewsTags"].includes(name)) expect(result).toMatchObject({ ok: true });
});
it("full-admin pages and section actions use the database role rather than role supplied by session", async () => {
  await account("active", "admin");
  for (const page of pages) await expect(page.call()).resolves.toBeDefined();
  expect(await mutations.find(m => m.name === "addDiscipline")!.call()).toMatchObject({ ok: true });
});

it.each(["members", "disciplines", "scientific-works", "news", "publications"])("allows every exported %s mutation through the section guard", async section => {
  await account("active", "user", section);
  for (const page of pages.filter(p => p.section === section)) await expect(page.call(), page.name).resolves.toBeDefined();
  for (const action of mutations.filter(m => m.section === section)) {
    const result = await action.call();
    expect(JSON.stringify(result), action.name).not.toMatch(/Недостаточно прав|Unauthorized|Требуется вход/);
  }
});
it("allows full-admin authorization on every exported mutation, including user management", async () => {
  await account("active", "admin");
  for (const action of mutations) {
    const result = await action.call();
    expect(JSON.stringify(result), action.name).not.toMatch(/Недостаточно прав|Unauthorized|Требуется вход/);
  }
});
const dictionarySections = ["disciplines", "scientific-works"] as const;
async function dictionaryFixture(section: typeof dictionarySections[number]) {
  await account("active", "user", section);
  const entry = section === "disciplines"
    ? await fixture.db.discipline.create({ data: { title: "Dictionary boundary" } })
    : await fixture.db.scientificWork.create({ data: { title: "Dictionary boundary" } });
  const member = await fixture.db.member.create({ data: {
    firstName: "Existing", lastName: "Member",
    ...(section === "disciplines" ? { disciplines: { connect: { id: entry.id } } } : { scientificWorks: { connect: { id: entry.id } } }),
  } });
  const actions = await import(/* @vite-ignore */ `../app/admin/${section}/actions.ts`) as Record<string, (input: unknown) => Promise<unknown>>;
  const update = section === "disciplines" ? actions.updateDiscipline : actions.updateScientificWork;
  return { entry, member, update };
}
const membersSnapshot = () => fixture.db.member.findMany({ orderBy: { id: "asc" }, include: {
  disciplines: { select: { id: true }, orderBy: { id: "asc" } },
  scientificWorks: { select: { id: true }, orderBy: { id: "asc" } },
} });
it.each(dictionarySections.flatMap(section => (["create", "update", "delete"] as const).map(operation => ({ section, operation }))))("$section-only editor cannot use nested members.$operation through a permitted dictionary update", async ({ section, operation }) => {
  const { entry, member, update } = await dictionaryFixture(section);
  const before = await membersSnapshot();
  const nested = {
    create: { firstName: "Injected", lastName: "Member" },
    update: { where: { id: member.id }, data: { firstName: "Changed through dictionary" } },
    delete: { id: member.id },
  }[operation];
  // Extra client fields are ignored: only validated scalar id/title may be used.
  const result = await update({ ...entry, title: "Allowed rename", members: { [operation]: nested } });
  expect(await membersSnapshot()).toEqual(before);
  expect(result).toMatchObject({ ok: true });
  const saved = section === "disciplines"
    ? await fixture.db.discipline.findUniqueOrThrow({ where: { id: entry.id } })
    : await fixture.db.scientificWork.findUniqueOrThrow({ where: { id: entry.id } });
  expect(saved.title).toBe("Allowed rename");
});
it.each(dictionarySections)("%s-only editor can still rename a dictionary from the existing full-record UI payload", async section => {
  const { entry, update } = await dictionaryFixture(section);
  expect(await update({ ...entry, title: "Renamed title" })).toMatchObject({ ok: true });
  const saved = section === "disciplines"
    ? await fixture.db.discipline.findUniqueOrThrow({ where: { id: entry.id } })
    : await fixture.db.scientificWork.findUniqueOrThrow({ where: { id: entry.id } });
  expect(saved).toMatchObject({ id: entry.id, title: "Renamed title" });
});
it.each(dictionarySections)("%s update rejects malformed scalar inputs before any dictionary/member mutation", async section => {
  const { entry, update } = await dictionaryFixture(section);
  const before = await membersSnapshot();
  for (const input of [null, { id: entry.id }, { id: {}, title: "Invalid" }, { id: entry.id, title: { set: "Prisma operation" } }]) {
    expect(await update(input)).toMatchObject({ ok: false });
  }
  expect(await membersSnapshot()).toEqual(before);
  const saved = section === "disciplines"
    ? await fixture.db.discipline.findUniqueOrThrow({ where: { id: entry.id } })
    : await fixture.db.scientificWork.findUniqueOrThrow({ where: { id: entry.id } });
  expect(saved.title).toBe(entry.title);
});
