import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { memberOrderBy } from "@/lib/member-order";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PrismaClient,
  auth: vi.fn(async () => ({ user: { role: "admin" } })),
  revalidateTag: vi.fn(),
  writeImage: vi.fn(async () => {}),
  copyImage: vi.fn(async () => {}),
  unlinkImage: vi.fn(async () => {}),
}));
vi.mock("@/prisma", () => ({
  get prisma() {
    return mocks.db;
  },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn(async () => {}),
    copyFile: mocks.copyImage,
    unlink: mocks.unlinkImage,
  },
}));
import {
  addMember,
  deleteMember,
  duplicateMember,
  reorderMembers,
  updateMember,
} from "./actions";

const migration = "20260916223000_add_member_sort_order";
let directory: string;
let migrationResult: {
  members: number;
  disciplines: number;
  works: number;
  order: number;
  foreignKeys: unknown[];
};

function deploy() {
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      join(directory, "schema.prisma"),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: `file:${join(directory, "test.db")}`,
        SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}`,
      },
      stdio: "pipe",
    },
  );
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-member-order-"));
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) {
    if (entry !== migration)
      cpSync(join("migrations", entry), join(directory, "migrations", entry), {
        recursive: true,
      });
  }
  writeFileSync(join(directory, "test.db"), "");
  deploy();
  mocks.db = new PrismaClient({
    datasources: { db: { url: `file:${join(directory, "test.db")}` } },
  });
  // Seed the old schema before adding the column, including both relation tables.
  await mocks.db.$executeRawUnsafe(
    `INSERT INTO "Member" (id, firstName, lastName) VALUES ('legacy', 'Иван', 'Иванов')`,
  );
  await mocks.db.$executeRawUnsafe(
    `INSERT INTO "Discipline" (id, title) VALUES ('legacy-d', 'Дисциплина')`,
  );
  await mocks.db.$executeRawUnsafe(
    `INSERT INTO "ScientificWork" (id, title) VALUES ('legacy-w', 'Работа')`,
  );
  await mocks.db.$executeRawUnsafe(
    `INSERT INTO "_DisciplineToMember" ("A", "B") VALUES ('legacy-d', 'legacy')`,
  );
  await mocks.db.$executeRawUnsafe(
    `INSERT INTO "_MemberToScientificWork" ("A", "B") VALUES ('legacy', 'legacy-w')`,
  );
  cpSync(
    join("migrations", migration),
    join(directory, "migrations", migration),
    { recursive: true },
  );
  deploy();
  const legacy = await mocks.db.member.findUniqueOrThrow({
    where: { id: "legacy" },
    include: { disciplines: true, scientificWorks: true },
  });
  migrationResult = {
    members: await mocks.db.member.count(),
    disciplines: legacy.disciplines.length,
    works: legacy.scientificWorks.length,
    order: legacy.sortOrder,
    foreignKeys: await mocks.db.$queryRawUnsafe("PRAGMA foreign_key_check"),
  };
  vi.stubEnv("DISABLE_ADMIN_AUTH", "false");
  vi.stubGlobal("Bun", {
    Image: class {
      resize() {
        return this;
      }
      webp() {
        return this;
      }
      write = mocks.writeImage;
    },
  });
}, 30000);

afterAll(async () => {
  await mocks.db?.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await mocks.db.member.deleteMany();
  await mocks.db.department.deleteMany();
  await mocks.db.discipline.deleteMany();
  await mocks.db.scientificWork.deleteMany();
  await mocks.db.department.createMany({
    data: [
      { id: "a", name: "Деканат" },
      { id: "b", name: "Преподаватели" },
    ],
  });
  await mocks.db.member.createMany({
    data: [
      {
        id: "a1",
        firstName: "Иван",
        lastName: "Иванов",
        departmentId: "a",
        sortOrder: 0,
      },
      {
        id: "a2",
        firstName: "Пётр",
        lastName: "Петров",
        departmentId: "a",
        sortOrder: 1,
      },
      {
        id: "b1",
        firstName: "Олег",
        lastName: "Орлов",
        departmentId: "b",
        sortOrder: 9,
      },
      { id: "n1", firstName: "Анна", lastName: "Смирнова", sortOrder: 0 },
      { id: "n2", firstName: "Иван", lastName: "Яковлев", sortOrder: 1 },
    ],
  });
});

const list = (departmentId: string | null) =>
  mocks.db.member.findMany({ where: { departmentId }, orderBy: memberOrderBy });
function form(id?: string, departmentId: string | null = "a") {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("lastName", "Алексеев");
  data.set("firstName", "Алексей");
  if (departmentId !== null) data.set("departmentId", departmentId);
  return data;
}

describe("persistent member order", () => {
  it("migrates an existing SQLite database without losing members or relations", () => {
    expect(migrationResult).toEqual({
      members: 1,
      disciplines: 1,
      works: 1,
      order: 0,
      foreignKeys: [],
    });
  });

  it("saves normalized order per group and immediately invalidates members", async () => {
    expect(
      await reorderMembers([{ departmentId: "a", memberIds: ["a2", "a1"] }]),
    ).toEqual({ ok: true, data: undefined });
    expect((await list("a")).map((m) => [m.id, m.sortOrder])).toEqual([
      ["a2", 0],
      ["a1", 1],
    ]);
    expect((await list("b"))[0].sortOrder).toBe(9);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("members", { expire: 0 });
  });

  it("breaks equal order ties by last name, first name, then ID", async () => {
    await mocks.db.member.deleteMany();
    await mocks.db.member.createMany({
      data: [
        { id: "3", lastName: "Белов", firstName: "Андрей" },
        { id: "2", lastName: "Алексеев", firstName: "Борис" },
        { id: "1b", lastName: "Алексеев", firstName: "Антон" },
        { id: "1a", lastName: "Алексеев", firstName: "Антон" },
      ],
    });
    expect((await list(null)).map((m) => m.id)).toEqual(["1a", "1b", "2", "3"]);
  });

  it.each([
    [{ departmentId: "a", memberIds: ["a1", "a1"] }],
    [{ departmentId: "a", memberIds: ["a1", "b1"] }],
    [{ departmentId: "a", memberIds: ["a1", "missing"] }],
    [{ departmentId: "a", memberIds: ["a1"] }],
    [{ departmentId: "missing", memberIds: [] }],
    [
      { departmentId: "a", memberIds: ["a1", "a2"] },
      { departmentId: "a", memberIds: [] },
    ],
  ])(
    "rejects duplicates, foreign, unknown or incomplete groups: %j",
    async (...groups) => {
      expect((await reorderMembers(groups)).ok).toBe(false);
      expect((await list("a")).map((m) => m.id)).toEqual(["a1", "a2"]);
      expect(mocks.revalidateTag).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    {},
    [{ departmentId: 1, memberIds: [] }],
    [{ departmentId: null, memberIds: [1] }],
  ])("rejects malformed input: %j", async (input) => {
    expect((await reorderMembers(input)).ok).toBe(false);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("requires administrator access", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { role: "user" } });
    expect(
      await reorderMembers([{ departmentId: "a", memberIds: ["a2", "a1"] }]),
    ).toEqual({ ok: false, error: "Unauthorized" });
    expect((await list("a")).map((m) => m.id)).toEqual(["a1", "a2"]);
  });

  it("rolls back earlier groups if a later group fails", async () => {
    expect(
      (
        await reorderMembers([
          { departmentId: "a", memberIds: ["a2", "a1"] },
          { departmentId: "b", memberIds: ["missing"] },
        ])
      ).ok,
    ).toBe(false);
    expect((await list("a")).map((m) => [m.id, m.sortOrder])).toEqual([
      ["a1", 0],
      ["a2", 1],
    ]);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("supports employees without a department", async () => {
    expect(
      (await reorderMembers([{ departmentId: null, memberIds: ["n2", "n1"] }]))
        .ok,
    ).toBe(true);
    expect((await list(null)).map((m) => m.id)).toEqual(["n2", "n1"]);
  });

  it.each(["a", null, "empty"])(
    "appends new employees to group %s, preserving form fields and relations",
    async (departmentId) => {
      if (departmentId === "empty")
        await mocks.db.department.create({
          data: { id: "empty", name: "Новое" },
        });
      await mocks.db.discipline.create({
        data: { id: "d", title: "Дисциплина" },
      });
      await mocks.db.scientificWork.create({
        data: { id: "w", title: "Работа" },
      });
      const data = form(undefined, departmentId);
      data.set(
        "image",
        new File(["image"], "photo.webp", { type: "image/webp" }),
      );
      data.set("phone", "+79991234567");
      data.set("email", "member@example.com");
      data.set("disciplines", "d");
      data.set("scientificWorks", "w");
      data.set("sortOrder", "-100"); // The server must never accept a client position.
      expect((await addMember(data)).ok).toBe(true);
      const members = await list(departmentId);
      const member = members.at(-1)!;
      expect(member).toMatchObject({
        firstName: "Алексей",
        sortOrder: departmentId === "empty" ? 0 : 2,
        email: "member@example.com",
        phone: "+7 999 123 45 67",
      });
      const saved = await mocks.db.member.findUniqueOrThrow({
        where: { id: member.id },
        include: { disciplines: true, scientificWorks: true },
      });
      expect(saved.disciplines.map((d) => d.id)).toEqual(["d"]);
      expect(saved.scientificWorks.map((w) => w.id)).toEqual(["w"]);
      expect(mocks.writeImage).toHaveBeenCalledOnce();
    },
  );

  it.each(["b", null])(
    "appends transferred employees to %s",
    async (departmentId) => {
      expect((await updateMember(form("a1", departmentId))).ok).toBe(true);
      const members = await list(departmentId);
      expect(members.at(-1)).toMatchObject({
        id: "a1",
        sortOrder: departmentId === "b" ? 10 : 2,
      });
      expect((await list("a")).map((m) => m.id)).toEqual(["a2"]);
    },
  );

  it("preserves order when editing in the same department, including null", async () => {
    expect((await updateMember(form("a2"))).ok).toBe(true);
    expect((await list("a"))[1]).toMatchObject({ id: "a2", sortOrder: 1 });
    expect((await updateMember(form("n2", null))).ok).toBe(true);
    expect((await list(null))[1]).toMatchObject({
      id: "n2",
      sortOrder: 1,
      departmentId: null,
    });
  });

  it("replaces the photo and relations without changing order", async () => {
    await mocks.db.discipline.create({
      data: { id: "d", title: "Дисциплина" },
    });
    await mocks.db.scientificWork.create({
      data: { id: "w", title: "Работа" },
    });
    const data = form("a2");
    data.set("image", new File(["replacement"], "new.webp"));
    data.set("disciplines", "d");
    data.set("scientificWorks", "w");
    expect((await updateMember(data)).ok).toBe(true);
    const saved = await mocks.db.member.findUniqueOrThrow({
      where: { id: "a2" },
      include: { disciplines: true, scientificWorks: true },
    });
    expect(saved.sortOrder).toBe(1);
    expect(saved.image).toBeTruthy();
    expect(saved.disciplines.map((d) => d.id)).toEqual(["d"]);
    expect(saved.scientificWorks.map((w) => w.id)).toEqual(["w"]);
    expect(mocks.writeImage).toHaveBeenCalledOnce();
    expect(mocks.unlinkImage).toHaveBeenCalledWith("uploads/members/a2.webp");
  });

  it.each(["a1", "n1"])(
    "appends a duplicate of %s and copies its photo and relations",
    async (id) => {
      await mocks.db.member.update({
        where: { id },
        data: {
          disciplines: { create: { title: "Дисциплина" } },
          scientificWorks: { create: { title: "Работа" } },
        },
      });
      expect((await duplicateMember(id)).ok).toBe(true);
      const members = await list(id === "a1" ? "a" : null);
      const duplicate = members.at(-1)!;
      expect(duplicate.sortOrder).toBe(2);
      expect(duplicate.id).not.toBe(id);
      const saved = await mocks.db.member.findUniqueOrThrow({
        where: { id: duplicate.id },
        include: { disciplines: true, scientificWorks: true },
      });
      expect(saved.disciplines).toHaveLength(1);
      expect(saved.scientificWorks).toHaveLength(1);
      expect(mocks.copyImage).toHaveBeenCalledWith(
        `uploads/members/${id}.webp`,
        `uploads/members/${duplicate.image}.webp`,
      );
    },
  );

  it("deletion keeps remaining positions and their relative order", async () => {
    await reorderMembers([{ departmentId: "a", memberIds: ["a2", "a1"] }]);
    expect((await deleteMember("a2")).ok).toBe(true);
    expect((await list("a")).map((m) => [m.id, m.sortOrder])).toEqual([
      ["a1", 1],
    ]);
    expect((await list("b"))[0].sortOrder).toBe(9);
  });
});
