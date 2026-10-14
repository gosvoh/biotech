import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createNewsPhotoFiles } from "./news-files";

let directory: string;
const manual = "cmg1234567890123456789012";
const vk = "vk-11111111-1111-4111-8111-111111111111";
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "biotech-news-copy-")); });
afterEach(async () => {
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "biotech-news-copy-"))) await rm(directory, { recursive: true, force: true });
});
it("copies legacy and VK photos with unique IDs and preserved ordering", async () => {
  await writeFile(join(directory, `${manual}.webp`), "manual");
  await writeFile(join(directory, `${vk}.webp`), "vk");
  const files = createNewsPhotoFiles({ directory });
  const first = await files.clone([{ id: manual, sortOrder: 2 }, { id: vk, sortOrder: 5 }]);
  const second = await files.clone([{ id: manual, sortOrder: 2 }]);
  expect(first.map(image => image.sortOrder)).toEqual([2, 5]);
  expect(new Set([...first, ...second].map(image => image.id)).size).toBe(3);
  expect(first.every(image => /^vk-[a-f0-9-]{36}$/.test(image.id))).toBe(true);
  expect(await Promise.all(first.map(image => readFile(join(directory, `${image.id}.webp`), "utf8")))).toEqual(["manual", "vk"]);
  await files.remove(first);
  expect(await readFile(join(directory, `${manual}.webp`), "utf8")).toBe("manual");
  expect(await readFile(join(directory, `${vk}.webp`), "utf8")).toBe("vk");
});
it("cleans its earlier copies when a later original file is absent", async () => {
  await writeFile(join(directory, `${manual}.webp`), "keep");
  const files = createNewsPhotoFiles({ directory });
  await expect(files.clone([{ id: manual, sortOrder: 0 }, { id: vk, sortOrder: 1 }])).rejects.toThrow(/фотограф/);
  expect(await readdir(directory)).toEqual([`${manual}.webp`]);
});
it.each(["../outside", "..\\outside", "/absolute", "C:\\outside", "photo.webp", ""])("rejects unsafe IDs before copying or deleting any valid file: %s", async unsafe => {
  await writeFile(join(directory, `${manual}.webp`), "keep");
  const files = createNewsPhotoFiles({ directory });
  await expect(files.clone([{ id: manual, sortOrder: 0 }, { id: unsafe, sortOrder: 1 }])).rejects.toThrow(/идентификатор/);
  await expect(files.remove([{ id: manual }, { id: unsafe }])).rejects.toThrow(/идентификатор/);
  expect(await readdir(directory)).toEqual([`${manual}.webp`]);
});
it("removes both manual and imported files and tolerates already absent files", async () => {
  await writeFile(join(directory, `${manual}.webp`), "manual");
  await writeFile(join(directory, `${vk}.webp`), "vk");
  const files = createNewsPhotoFiles({ directory });
  await files.remove([{ id: manual }, { id: vk }]);
  await files.remove([{ id: manual }, { id: vk }]);
  expect(await readdir(directory)).toEqual([]);
});
