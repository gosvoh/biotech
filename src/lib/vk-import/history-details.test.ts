import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createAuthFixture } from "@/lib/auth-test-fixture";
import { listVkHistoryDetails } from "./history-details";

let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
beforeAll(async () => { fixture = await createAuthFixture(); }, 30000);
beforeEach(async () => {
  await fixture.db.vkImportSource.deleteMany();
  await fixture.db.vkImportSource.create({ data: { groupId: "123", name: "Fixture", screenName: "fixture" } });
  await fixture.db.vkHistoryJob.create({ data: { id: "job", groupId: "123", from: "2026-09-01", to: "2026-10-01", state: "completed" } });
});
afterAll(async () => { await fixture?.close(); });
const input = { jobId: "job", page: 1, filter: "all" as const };

it("reads twenty safe details in stable postId descending order, filters and clamps after rows shrink", async () => {
  await fixture.db.vkHistoryPost.createMany({ data: Array.from({ length: 45 }, (_, i) => ({
    jobId: "job", postId: String(100 + i), snapshot: { photos: [{ url: "PRIVATE_PHOTO" }], token: "SECRET" },
    state: i < 21 ? "failed" : "done", outcome: i < 21 ? null : i < 42 ? "skipped" : "added",
    reasonCode: "fixture", reasonText: "Сохранённая причина",
  })) });
  const first = await listVkHistoryDetails(fixture.db, input);
  expect(first).toMatchObject({ total: 45, page: 1, pageSize: 20 });
  expect(first.items).toHaveLength(20);
  expect(first.items[0]).toEqual({ postId: "144", sourceUrl: "https://vk.com/wall-123_144", state: "done", outcome: "added", reasonCode: "fixture", reasonText: "Сохранённая причина" });
  expect(first.items.at(-1)?.postId).toBe("125");
  const second = await listVkHistoryDetails(fixture.db, { ...input, page: 2 });
  expect(second.items[0].postId).toBe("124");
  expect((await listVkHistoryDetails(fixture.db, { ...input, filter: "skipped" })).total).toBe(21);
  expect((await listVkHistoryDetails(fixture.db, { ...input, filter: "failed", page: 2 })).items.map((row) => row.postId)).toEqual(["100"]);
  await fixture.db.vkHistoryPost.deleteMany({ where: { jobId: "job", postId: { not: "100" } } });
  expect(await listVkHistoryDetails(fixture.db, { ...input, page: 3 })).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  expect(JSON.stringify(first)).not.toMatch(/snapshot|PRIVATE_PHOTO|SECRET/);
});

it("does not invent reasons for legacy rows or expose malformed source links", async () => {
  await fixture.db.vkHistoryPost.create({ data: { jobId: "job", postId: "5", state: "done", outcome: "skipped", snapshot: { text: "#NewTag" }, error: "OLD_SECRET" } });
  await fixture.db.newsTags.create({ data: { title: "NewTag", normalizedTitle: "newtag" } });
  expect((await listVkHistoryDetails(fixture.db, input)).items[0]).toMatchObject({ reasonCode: null, reasonText: "Подробная причина не сохранена для этой записи" });
  await fixture.db.vkHistoryPost.create({ data: { jobId: "job", postId: "<unsafe>", snapshot: {} } });
  expect((await listVkHistoryDetails(fixture.db, input)).items.find((row) => row.postId === "<unsafe>")?.sourceUrl).toBeNull();
  await fixture.db.vkImportSource.create({ data: { groupId: "abc/path", name: "Fixture", screenName: "fixture" } });
  await fixture.db.vkHistoryJob.create({ data: { id: "unsafe", groupId: "abc/path", from: "2026-09-01", to: "2026-10-01", posts: { create: { postId: "1", snapshot: {} } } } });
  expect((await listVkHistoryDetails(fixture.db, { ...input, jobId: "unsafe" })).items[0].sourceUrl).toBeNull();
});

it.each([null, {}, { ...input, jobId: "" }, { ...input, jobId: "missing" }, { ...input, filter: "other" }, ...[0, -1, 1.5, "1", NaN, Infinity, Number.MAX_SAFE_INTEGER].map((page) => ({ ...input, page }))])("rejects invalid input %j", async (value) => {
  await expect(listVkHistoryDetails(fixture.db, value)).rejects.toThrow();
});
it("rejects a job after its source disappears and returns page one for empty history", async () => {
  expect(await listVkHistoryDetails(fixture.db, { ...input, page: 5 })).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  await fixture.db.vkImportSource.delete({ where: { groupId: "123" } });
  await expect(listVkHistoryDetails(fixture.db, input)).rejects.toThrow("не найдена");
});
