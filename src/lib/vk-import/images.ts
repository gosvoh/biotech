import { randomUUID } from "node:crypto";
import { mkdir, open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { PreparedVkImage, VkImageStore } from "./types";

const MAX_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const OWN_IMAGE_ID = /^vk-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TRUSTED_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*(?:userapi\.com|vkuserphoto\.ru|vk-cdn\.net)$/;

function trustedPhotoUrl(value: string): URL {
  // Reject syntax that the URL parser silently normalizes, including userinfo.
  if (!/^https:\/\//i.test(value) || /[\s\\]/.test(value) || /^https:\/\/[^/]*@/i.test(value)) {
    throw new Error("Unsafe VK photo URL");
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid VK photo URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !TRUSTED_HOST.test(url.hostname)) {
    throw new Error("Unsafe VK photo URL");
  }
  return url;
}

async function convertToWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const image = new Bun.Image(bytes, { maxPixels: 40_000_000 });
  const { width, height } = await image.metadata();
  if (width < 1 || height < 1 || width > 16_384 || height > 16_384 || width * height > 40_000_000) {
    throw new Error("VK photo dimensions exceed the decode limit");
  }
  return image.webp({ quality: 85 }).bytes();
}

async function downloadPhoto(value: string, fetcher: typeof fetch, heartbeat?: () => Promise<void>): Promise<Uint8Array> {
  let url = trustedPhotoUrl(value);
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("VK photo download timed out"));
      controller.abort();
      void reader?.cancel().catch(() => {});
    }, DOWNLOAD_TIMEOUT_MS);
  });
  const download = async () => {
    for (let redirects = 0; ; redirects++) {
      await heartbeat?.();
      controller.signal.throwIfAborted();
      const response = await fetcher(url, { redirect: "manual", signal: controller.signal, credentials: "omit" });
      controller.signal.throwIfAborted();
      try { if (response.url) trustedPhotoUrl(response.url); }
      catch (error) { void response.body?.cancel().catch(() => {}); throw error; }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        void response.body?.cancel().catch(() => {});
        const location = response.headers.get("location");
        if (!location || redirects >= MAX_REDIRECTS) throw new Error("VK photo redirect limit exceeded");
        // Relative redirects are valid, but reject ambiguous URL syntax first.
        if (/[\s\\]/.test(location) || /^(?:https:)?\/\/[^/?#]*@/i.test(location)) {
          throw new Error("Unsafe VK photo redirect URL");
        }
        url = trustedPhotoUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok || !response.body) {
        void response.body?.cancel().catch(() => {});
        throw new Error("VK photo download failed");
      }
      const declaredSize = response.headers.get("content-length");
      if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > MAX_BYTES)) {
        void response.body.cancel().catch(() => {});
        throw new Error("VK photo size limit exceeded");
      }
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          controller.signal.throwIfAborted();
          const chunk = await reader.read();
          controller.signal.throwIfAborted();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > MAX_BYTES) throw new Error("VK photo size limit exceeded");
          chunks.push(chunk.value);
        }
        if (!size) throw new Error("VK photo is empty");
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return bytes;
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
  };
  try { return await Promise.race([download(), timedOut]); }
  finally { clearTimeout(timer); }
}

export function createVkImageStore(options: {
  directory?: string;
  fetcher?: typeof fetch;
  convert?: (bytes: Uint8Array) => Promise<Uint8Array>;
} = {}): VkImageStore {
  const directory = resolve(/* turbopackIgnore: true */ options.directory ?? "./uploads/news");
  const fetcher = options.fetcher ?? fetch;
  const convert = options.convert ?? convertToWebp;

  async function discard(images: PreparedVkImage[]): Promise<void> {
    // Validate the entire list before deleting anything. Manual images are never owned here.
    if (images.some(image => !OWN_IMAGE_ID.test(image.id))) throw new Error("Unsafe or unowned VK image id");
    const failures = (await Promise.allSettled(images.map(async image => {
      try { await unlink(join(directory, `${image.id}.webp`)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }))).filter(result => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), "VK photo cleanup failed");
  }

  return {
    async prepare(photos, heartbeat) {
      const owned: PreparedVkImage[] = [];
      try {
        for (const [sortOrder, photo] of photos.entries()) {
          const bytes = await downloadPhoto(photo.url, fetcher, heartbeat);
          await heartbeat?.();
          const converted = await convert(bytes);
          if (!converted.byteLength || converted.byteLength > MAX_BYTES) throw new Error("Converted VK photo size limit exceeded");
          await heartbeat?.();
          await mkdir(directory, { recursive: true });
          const image = { id: `vk-${randomUUID()}`, sortOrder };
          // Exclusive creation cannot overwrite another news image. Record ownership
          // before writing, so even a partial write is included in rollback.
          const file = await open(join(directory, `${image.id}.webp`), "wx");
          owned.push(image);
          try { await file.writeFile(converted); } finally { await file.close(); }
        }
        return owned;
      } catch (error) {
        try { await discard(owned); }
        catch (cleanupError) { throw new AggregateError([error, cleanupError], "VK photo preparation and cleanup failed"); }
        throw error;
      }
    },
    discard,
  };
}
