import { randomUUID } from "node:crypto";
import { lstat, open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { PreparedVkImage } from "./types";

const IMAGE_ID = /^(?:c[a-z0-9]{24}|vk-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;

export interface NewsPhotoFiles {
  clone(images: { id: string; sortOrder: number }[]): Promise<PreparedVkImage[]>;
  remove(images: { id: string }[]): Promise<void>;
}

/** The directory is supplied by the application, never by submitted news data. */
export function createNewsPhotoFiles(options: { directory?: string } = {}): NewsPhotoFiles {
  const directory = options.directory
    ? resolve(/* turbopackIgnore: true */ options.directory)
    : resolve("./uploads/news");
  const pathFor = (id: string) => join(directory, `${id}.webp`);
  const validate = (images: { id: string }[]) => {
    if (images.some(image => !IMAGE_ID.test(image.id))) throw new Error("Недопустимый идентификатор фотографии.");
  };

  async function remove(images: { id: string }[]): Promise<void> {
    // Validate the complete list before deleting any file.
    validate(images);
    const results = await Promise.allSettled(images.map(async image => {
      try { await unlink(pathFor(image.id)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }));
    if (results.some(result => result.status === "rejected")) throw new Error("Не удалось удалить некоторые фотографии.");
  }

  return {
    async clone(images) {
      validate(images);
      const owned: PreparedVkImage[] = [];
      try {
        for (const image of images) {
          const originalPath = pathFor(image.id);
          if (!(await lstat(originalPath)).isFile()) throw new Error("Фотография не является обычным файлом.");
          const original = await open(originalPath, "r");
          try {
            const bytes = await original.readFile();
            const copy = { id: `vk-${randomUUID()}`, sortOrder: image.sortOrder };
            // Exclusive creation cannot overwrite an unrelated image. Ownership is
            // recorded before writing so partial writes are included in rollback.
            const target = await open(pathFor(copy.id), "wx");
            owned.push(copy);
            try { await target.writeFile(bytes); } finally { await target.close(); }
          } finally { await original.close(); }
        }
        return owned;
      } catch {
        try { await remove(owned); }
        catch { throw new Error("Не удалось скопировать фотографии и удалить временные копии."); }
        throw new Error("Не удалось скопировать все фотографии. Исходная новость сохранена.");
      }
    },
    remove,
  };
}
