import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, open, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVkImageStore } from "./images";

const url = "https://sun9-1.userapi.com/photo.jpg";
const convert = async (bytes: Uint8Array) => new Uint8Array([87, ...bytes]);
const fetcher = (run: (url: string, init?: RequestInit) => Promise<Response>) =>
  ((input, init) => run(String(input), init)) as typeof fetch;

describe("local VK photographs", () => {
  let directory: string;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "vk-images-")); });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("stores all photographs in order with fresh safe ids and lease heartbeats", async () => {
    const events: string[] = [];
    const store = createVkImageStore({ directory,
      fetcher: fetcher(async (input) => {
        events.push("fetch");
        return new Response(input.endsWith("first") ? new Uint8Array([1]) : new Uint8Array([2]));
      }),
      convert: async bytes => { events.push("convert"); return convert(bytes); },
    });
    const images = await store.prepare([{ url: `${url}?first` }, { url: `${url}?second` }],
      async () => { events.push("heartbeat"); });
    expect(images.map(image => image.sortOrder)).toEqual([0, 1]);
    expect(images[0].id).not.toBe(images[1].id);
    for (const image of images) expect(image.id).toMatch(/^vk-[a-f0-9-]{36}$/);
    expect(await readFile(join(directory, `${images[0].id}.webp`))).toEqual(Buffer.from([87, 1]));
    expect(await readFile(join(directory, `${images[1].id}.webp`))).toEqual(Buffer.from([87, 2]));
    expect(events).toEqual(["heartbeat", "fetch", "heartbeat", "convert", "heartbeat",
      "heartbeat", "fetch", "heartbeat", "convert", "heartbeat"]);
    await store.discard(images);
    await store.discard(images);
    expect(await readdir(directory)).toEqual([]);
  });

  it("returns no files for a text-only post", async () => {
    const store = createVkImageStore({ directory, fetcher: fetcher(async () => { throw Error("unexpected network"); }), convert });
    expect(await store.prepare([])).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
  });

  it.each(["fetch", "convert", "heartbeat"])("rolls back every prepared file after a later %s failure", async phase => {
    await writeFile(join(directory, "manual.webp"), "preserve");
    let fetched = 0;
    const store = createVkImageStore({ directory,
      fetcher: fetcher(async () => {
        fetched++;
        if (phase === "fetch" && fetched === 2) throw Error("network failed");
        return new Response(new Uint8Array([fetched]));
      }),
      convert: async bytes => {
        if (phase === "convert" && bytes[0] === 2) throw Error("decode failed");
        return convert(bytes);
      },
    });
    await expect(store.prepare([{ url }, { url }], async () => {
      if (phase === "heartbeat" && fetched === 2) throw Error("lease lost");
    })).rejects.toThrow();
    expect(await readdir(directory)).toEqual(["manual.webp"]);
  });

  it.each([
    "http://sun9-1.userapi.com/p.jpg", "https://127.0.0.1/p.jpg", "https://[::1]/p.jpg",
    "https://192.168.1.1/p.jpg", "https://userapi.com.evil.example/p.jpg",
    "https://eviluserapi.com/p.jpg", "https://evil.example/userapi.com/p.jpg",
    "https://user:pass@sun9-1.userapi.com/p.jpg", "https://@sun9-1.userapi.com/p.jpg",
    "https://sun9-1.userapi.com:444/p.jpg", "https://sun9-1.userapi.com./p.jpg",
    " https://sun9-1.userapi.com/p.jpg", "https://sun9-1.userapi.com\\evil/p.jpg",
  ])("rejects an unsafe CDN URL before the network: %s", async unsafeUrl => {
    const store = createVkImageStore({ directory, fetcher: fetcher(async () => { throw Error("network reached"); }), convert });
    await expect(store.prepare([{ url: unsafeUrl }])).rejects.toThrow(/URL/i);
    expect(await readdir(directory)).toEqual([]);
  });

  it.each(["https://sun1.vkuserphoto.ru/p.jpg", "https://sun1.vk-cdn.net/p.jpg"])("accepts the trusted photo CDN %s", async trustedUrl => {
    const store = createVkImageStore({ directory, fetcher: fetcher(async () => new Response(new Uint8Array([1]))), convert });
    const images = await store.prepare([{ url: trustedUrl }]);
    expect(await readFile(join(directory, `${images[0].id}.webp`))).toEqual(Buffer.from([87, 1]));
  });

  it("follows validated CDN redirects manually", async () => {
    const destinations: string[] = [];
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async (input, init) => {
      if (init?.redirect !== "manual") throw Error("unsafe redirect mode");
      destinations.push(input);
      return destinations.length === 1
        ? new Response(null, { status: 302, headers: { location: "https://sun1.vkuserphoto.ru/final.jpg" } })
        : new Response(new Uint8Array([3]));
    }) });
    const images = await store.prepare([{ url }]);
    expect(destinations).toEqual([url, "https://sun1.vkuserphoto.ru/final.jpg"]);
    expect(await readFile(join(directory, `${images[0].id}.webp`))).toEqual(Buffer.from([87, 3]));
  });

  it("blocks redirects off the trusted CDN", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async input => {
      if (input !== url) throw Error("private network reached");
      return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/secret" } });
    }) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/URL/i);
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects empty userinfo in a redirect before URL normalization erases it", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async input => {
      if (input !== url) return new Response(new Uint8Array([1]));
      return new Response(null, { status: 302, headers: { location: "https://@sun9-1.userapi.com/other.jpg" } });
    }) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/URL/i);
    expect(await readdir(directory)).toEqual([]);
  });

  it("aborts a stalled body stream rather than only timing response headers", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let started = false;
    let cancelled = false;
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () => {
      started = true;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array([1])); },
        cancel() { cancelled = true; },
      }));
    }) });
    const rejection = expect(store.prepare([{ url }])).rejects.toThrow(/timeout|timed out/i);
    while (!started) await new Promise(resolve => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(25_000);
    await rejection;
    expect(cancelled).toBe(true);
    expect(await readdir(directory)).toEqual([]);
  });

  it("limits redirect loops", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () =>
      new Response(null, { status: 302, headers: { location: "/loop.jpg" } })) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/redirect/i);
  });

  it("aborts a stalled download and rolls back earlier images", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let fetched = 0;
    let aborted = false;
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async (_, init) => {
      if (++fetched === 1) return new Response(new Uint8Array([1]));
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise<Response>(() => {});
    }) });
    const pending = store.prepare([{ url }, { url }]);
    const rejection = expect(pending).rejects.toThrow(/timeout|timed out/i);
    while (fetched < 2) await new Promise(resolve => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(25_000);
    await rejection;
    expect(aborted).toBe(true);
    expect(await readdir(directory)).toEqual([]);
  });

  it("limits a body stream even when content-length understates its size", async () => {
    let cancelled = false;
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () =>
      new Response(new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(11 * 1024 * 1024)); },
        cancel() { cancelled = true; },
      }), { headers: { "content-length": "1" } })) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/size|large|limit/i);
    expect(cancelled).toBe(true);
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects oversized content-length before reading the body", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () =>
      new Response(new Uint8Array([1]), { headers: { "content-length": String(21 * 1024 * 1024) } })) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/size|large|limit/i);
    expect(await readdir(directory)).toEqual([]);
  });

  it("removes an image even when writing it only partially succeeds", async () => {
    const probe = join(directory, "probe");
    const handle = await open(probe, "wx");
    const write = handle.writeFile;
    const prototype = Object.getPrototypeOf(handle) as Pick<typeof handle, "writeFile">;
    await handle.close();
    await unlink(probe);
    let writes = 0;
    vi.spyOn(prototype, "writeFile").mockImplementation(async function (this: typeof handle, ...args: Parameters<typeof handle.writeFile>) {
      const [bytes, options] = args;
      writes++;
      await write.call(this, writes === 2 && bytes instanceof Uint8Array ? bytes.subarray(0, 1) : bytes, options);
      if (writes === 2) throw Error("disk full after partial write");
    });
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () => new Response(new Uint8Array([1, 2]))) });
    await expect(store.prepare([{ url }, { url }])).rejects.toThrow("disk full");
    expect(await readdir(directory)).toEqual([]);
  });

  it("keeps every file if discard includes an unsafe id", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () => new Response(new Uint8Array([1]))) });
    const images = await store.prepare([{ url }]);
    await expect(store.discard([...images, { id: "../manual", sortOrder: 1 }])).rejects.toThrow();
    expect(await readFile(join(directory, `${images[0].id}.webp`))).toEqual(Buffer.from([87, 1]));
  });

  it("rejects empty downloads without files", async () => {
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () => new Response(new Uint8Array())) });
    await expect(store.prepare([{ url }])).rejects.toThrow(/empty/i);
    expect(await readdir(directory)).toEqual([]);
  });

  it("rolls back when the server refuses a later photograph", async () => {
    let fetched = 0;
    const store = createVkImageStore({ directory, convert, fetcher: fetcher(async () => ++fetched === 1
      ? new Response(new Uint8Array([1])) : new Response(null, { status: 403 })) });
    await expect(store.prepare([{ url }, { url }])).rejects.toThrow();
    expect(await readdir(directory)).toEqual([]);
  });

  it.each(["../manual", "manual", "vk-../../manual", "vk-C:\\manual"])("refuses to discard an unowned or unsafe id %s", async id => {
    await writeFile(join(directory, "manual.webp"), "preserve");
    const store = createVkImageStore({ directory, convert });
    await expect(store.discard([{ id, sortOrder: 0 }])).rejects.toThrow(/id|owned|safe/i);
    expect(await readFile(join(directory, "manual.webp"), "utf8")).toBe("preserve");
  });
});
