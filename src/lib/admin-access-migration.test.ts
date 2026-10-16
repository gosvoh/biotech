import { afterAll, beforeAll, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { PrismaClient } from "@/lib/db/client";

const migration = "20261016190000_admin_section_access";
const historyMigration = "20261016200000_vk_history_reasons";
const testRoot = resolve("database/admin-redesign");
let directory: string;
let db: PrismaClient;
type Snapshot = { table: string; columns: string[]; rows: unknown[] }[];
let before: Snapshot;

function deploy() {
  return execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
    env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` },
    cwd: directory, encoding: "utf8", stdio: "pipe",
  });
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
async function insert(table: string, data: Record<string, string | number | null>) {
  await db.$executeRawUnsafe(`INSERT INTO ${quote(table)} (${Object.keys(data).map(quote).join(", ")}) VALUES (${Object.keys(data).map(() => "?").join(", ")})`, ...Object.values(data));
}
async function snapshot(): Promise<Snapshot> {
  const tables = await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name");
  return Promise.all(tables.map(async ({ name }) => {
    const info = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info(${quote(name)})`);
    return { table: name, columns: info.map((column) => column.name), rows: await db.$queryRawUnsafe(`SELECT * FROM ${quote(name)} ORDER BY rowid`) as unknown[] };
  }));
}
async function assertLegacyUnchanged() {
  for (const { table, columns, rows } of before) {
    expect(await db.$queryRawUnsafe(`SELECT ${columns.map(quote).join(", ")} FROM ${quote(table)} ORDER BY rowid`), table).toEqual(rows);
  }
}

beforeAll(async () => {
  mkdirSync(testRoot, { recursive: true });
  directory = mkdtempSync(join(testRoot, "task-2-test-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) {
    if (entry !== migration && entry !== historyMigration) cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  }
  deploy();
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  const timestamps = { createdAt: "2026-10-01T09:00:00.000Z", updatedAt: "2026-10-02T09:00:00.000Z" };
  await insert("User", { id: "admin-id", role: "admin", email: "Admin@Example.test", name: "Администратор", image: "admin.webp", emailVerified: timestamps.createdAt, ...timestamps });
  await insert("User", { id: "user-id", role: "user", email: "Editor@Example.test", name: "Редактор", image: null, emailVerified: null, ...timestamps });
  await insert("User", { id: "legacy-id", role: "legacy-role", email: null, name: null, ...timestamps });
  await insert("Account", { id: "account-id", userId: "admin-id", type: "oauth", provider: "fixture", providerAccountId: "provider-id", refresh_token: "fixture-refresh", access_token: "fixture-access", expires_at: 123456, token_type: "bearer", scope: "profile", id_token: "fixture-id", session_state: "fixture-state", ...timestamps });
  await insert("Session", { id: "session-id", userId: "user-id", sessionToken: "fixture-session", expires: "2027-01-01T00:00:00.000Z", ...timestamps });
  await insert("VerificationToken", { identifier: "Admin@Example.test", token: "fixture-verification", expires: "2027-01-01T00:00:00.000Z", ...timestamps });
  await insert("Department", { id: "department-id", name: "Кафедра", ...timestamps });
  await insert("Member", { id: "member-id", firstName: "Иван", lastName: "Иванов", middleName: "Иванович", departmentId: "department-id", position: "Доцент", email: "member@example.test", phone: "+70000000000", image: "member.webp", sortOrder: 7, ...timestamps });
  await insert("Discipline", { id: "discipline-id", title: "Биология", ...timestamps });
  await insert("ScientificWork", { id: "work-id", title: "Исследование", ...timestamps });
  await insert("_DisciplineToMember", { A: "discipline-id", B: "member-id" });
  await insert("_MemberToScientificWork", { A: "member-id", B: "work-id" });
  await insert("Publication", { id: "publication-id", title: "Статья", year: "2026", authors: "Иванов", link: "https://example.test/article", ...timestamps });
  await insert("News", { id: "news-id", title: "Новость", text: "Исходный текст", links: "https://example.test", hidden: 1, date: "2026-09-30", ...timestamps });
  await insert("NewsTags", { id: "tag-id", title: "Наука", normalizedTitle: "наука", ...timestamps });
  await insert("_NewsToNewsTags", { A: "news-id", B: "tag-id" });
  await insert("NewsImages", { id: "image-id", newsId: "news-id", sortOrder: 2, ...timestamps });
  await insert("VkImportSource", { groupId: "123", name: "Группа", screenName: "fixture", cursorDate: 1234, autoEnabled: 1, autoRevision: 3, lastResult: '{"added":1}' });
  await insert("VkImportPost", { groupId: "123", postId: "456", newsId: "news-id", status: "imported", syncEnabled: 0, manualHidden: 1, snapshot: '{"text":"Исходный текст"}' });
  await insert("VkImportTagCatalog", { id: 1, revision: 4 });
  await insert("VkHistoryJob", { id: "history-id", groupId: "123", from: "2026-09-01", to: "2026-10-01", state: "queued", activeKey: "123", ...timestamps });
  await insert("VkHistoryPost", { jobId: "history-id", postId: "456", snapshot: '{"id":"456"}', state: "done", outcome: "skipped", attempts: 2, error: "Legacy reason" });
  await insert("VkAutomationRuntime", { id: 1, currentGroupId: "123", lastHistoryId: "history-id", nextQueueAt: timestamps.createdAt });
  before = await snapshot();
  // Reopen after the schema upgrade so cached pre-upgrade SELECT metadata cannot
  // turn newly added columns into an "undefined" key in Prisma's raw results.
  await db.$disconnect();
  cpSync(join("migrations", migration), join(directory, "migrations", migration), { recursive: true });
  cpSync(join("migrations", historyMigration), join(directory, "migrations", historyMigration), { recursive: true });
  deploy();
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);

afterAll(async () => {
  await db?.$disconnect();
  if (directory) {
    const local = relative(testRoot, resolve(directory));
    if (!local.startsWith(`..${sep}`) && !local.includes(sep) && local.startsWith("task-2-test-")) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

it("preserves every existing value and relation, activates old users and keeps old links at revision zero", async () => {
  await assertLegacyUnchanged();
  expect(await db.vkHistoryPost.findUniqueOrThrow({ where: { jobId_postId: { jobId: "history-id", postId: "456" } } })).toMatchObject({ state: "done", outcome: "skipped", attempts: 2, snapshot: { id: "456" }, reasonCode: null, reasonText: null });
  expect(await db.$queryRawUnsafe('SELECT "id", "accessStatus", "accessRevision" FROM "User" ORDER BY "id"')).toEqual([
    { id: "admin-id", accessStatus: "active", accessRevision: 0 },
    { id: "legacy-id", accessStatus: "active", accessRevision: 0 },
    { id: "user-id", accessStatus: "active", accessRevision: 0 },
  ]);
  expect(await db.$queryRawUnsafe('SELECT "token", "accessRevision" FROM "VerificationToken"')).toEqual([{ token: "fixture-verification", accessRevision: 0 }]);
  expect(await db.$queryRawUnsafe("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
  expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});

it("deploys again without changing any data", async () => {
  const migrated = await snapshot();
  expect(deploy()).toContain("No pending migrations to apply");
  expect(await snapshot()).toEqual(migrated);
  await assertLegacyUnchanged();
}, 30000);

it("defaults new accounts to pending, persists revisions, enforces unique permissions and cascades them", async () => {
  const created = await db.user.create({ data: { id: "new-id", email: "new@example.test" } });
  expect(created).toMatchObject({ role: "user", accessStatus: "pending", accessRevision: 0 });
  await db.user.update({ where: { id: created.id }, data: { accessStatus: "active", accessRevision: 2 } });
  await db.userSectionPermission.create({ data: { userId: created.id, section: "news" } });
  await db.userSectionPermission.create({ data: { userId: created.id, section: "members" } });
  await expect(db.userSectionPermission.create({ data: { userId: created.id, section: "news" } })).rejects.toMatchObject({ code: "P2002" });
  await expect(db.userSectionPermission.create({ data: { userId: "missing", section: "news" } })).rejects.toMatchObject({ code: "P2003" });
  const token = await db.verificationToken.create({ data: { identifier: "new@example.test", token: "new-token", expires: new Date("2027-01-01"), accessRevision: 2 } });
  expect(token.accessRevision).toBe(2);
  await db.user.delete({ where: { id: created.id } });
  expect(await db.userSectionPermission.count({ where: { userId: created.id } })).toBe(0);
  expect(await db.$queryRawUnsafe("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
  expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});

it("stores rate limits with unique keys and an expiration index", async () => {
  const expiresAt = new Date("2027-01-01");
  expect(await db.authRateLimit.create({ data: { key: "email:fixture", count: 1, expiresAt } })).toEqual({ key: "email:fixture", count: 1, expiresAt });
  await expect(db.authRateLimit.create({ data: { key: "email:fixture", count: 2, expiresAt } })).rejects.toMatchObject({ code: "P2002" });
  expect(await db.$queryRawUnsafe('PRAGMA index_info("AuthRateLimit_expiresAt_idx")')).toEqual([{ seqno: BigInt(0), cid: BigInt(2), name: "expiresAt" }]);
});
