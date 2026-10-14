import { afterEach, describe, expect, it, vi } from "vitest";
import { createVkApi, getVkApiErrorMessage } from "./client";

const secret = "fake-token-do-not-expose";
const config = { group: "biotech.itmo", token: secret };
const post = {
  id: 7, owner_id: -123, from_id: -123, date: 1788210000,
  text: "Заголовок\nТекст #образование", post_type: "post",
  attachments: [], copy_history: [],
};
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const fakeFetch = (handler: (url: string, init: RequestInit) => Promise<Response> | Response) =>
  (async (url: RequestInfo | URL, init?: RequestInit) => handler(String(url), init!)) as typeof fetch;

afterEach(() => vi.useRealTimers());

describe("VK HTTP boundary", () => {
  it("resolves group canonical identity using the v5.199 groups envelope and POST credentials", async () => {
    const api = createVkApi(config, fakeFetch((url, init) => {
      expect(url).toBe("https://api.vk.com/method/groups.getById");
      expect(url).not.toContain(secret);
      expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      const body = new URLSearchParams(String(init.body));
      expect(Object.fromEntries(body)).toEqual({ group_ids: "biotech.itmo", access_token: secret, v: "5.199" });
      return response({ response: { groups: [{ id: 123, name: "Биотех", screen_name: "biotech.itmo", type: "group", is_closed: 0 }] } });
    }));
    expect(await api.getGroup()).toEqual({ id: "123", name: "Биотех", screenName: "biotech.itmo" });
  });

  it("normalizes negative configured group ID for groups.getById", async () => {
    const api = createVkApi({ ...config, group: "-123" }, fakeFetch((_url, init) => {
      expect(new URLSearchParams(String(init.body)).get("group_ids")).toBe("123");
      return response({ response: { groups: [{ id: 123, name: "Биотех", screen_name: "biotech.itmo" }] } });
    }));
    expect((await api.getGroup()).id).toBe("123");
  });

  it("reads all wall posts in bounded pages and preserves post metadata for engine selection", async () => {
    const api = createVkApi(config, fakeFetch((url, init) => {
      expect(url).toBe("https://api.vk.com/method/wall.get");
      const body = new URLSearchParams(String(init.body));
      expect(body.get("owner_id")).toBe("-123");
      expect(body.get("offset")).toBe("30");
      expect(body.get("count")).toBe("100");
      expect(body.get("filter")).toBe("all");
      return response({ response: { count: 501, items: [{ ...post, from_id: 5, is_pinned: 1, copy_history: [{ id: 8 }] }] } });
    }));
    expect(await api.getWall("123", 30, 250)).toEqual({ count: 501, items: [{
      id: "7", ownerId: "-123", fromId: "5", date: 1788210000,
      text: "Заголовок\nТекст #образование", isPinned: true, isRepost: true, postType: "post", photos: [],
    }] });
  });

  it("preserves photo attachment order and selects the largest available size", async () => {
    const api = createVkApi(config, fakeFetch(() => response({ response: { count: 1, items: [{ ...post, attachments: [
      { type: "photo", photo: { sizes: [{ url: "https://sun.vk.test/small.jpg", width: 75, height: 75 }, { url: "https://sun.vk.test/first.jpg", width: 1280, height: 720 }] } },
      { type: "video", video: { id: 1 } },
      { type: "photo", photo: { sizes: [{ url: "https://sun.vk.test/second.jpg", width: 500, height: 500 }] } },
    ] }] } })));
    expect((await api.getWall("123", 0, 1)).items[0].photos).toEqual([
      { url: "https://sun.vk.test/first.jpg" }, { url: "https://sun.vk.test/second.jpg" },
    ]);
  });

  it("chunks post lookup into at most 100 IDs using the object items envelope", async () => {
    const requested: string[][] = [];
    const api = createVkApi(config, fakeFetch((url, init) => {
      expect(url).toBe("https://api.vk.com/method/wall.getById");
      const ids = new URLSearchParams(String(init.body)).get("posts")!.split(",");
      requested.push(ids);
      return response({ response: { items: ids.map((id) => ({ ...post, id: Number(id.split("_")[1]) })) } });
    }));
    const posts = await api.getPosts("123", Array.from({ length: 101 }, (_v, index) => String(index + 1)));
    expect(requested.map((ids) => ids.length)).toEqual([100, 1]);
    expect(requested[0][0]).toBe("-123_1");
    expect(requested[1]).toEqual(["-123_101"]);
    expect(posts.map((item) => item.id)).toEqual(Array.from({ length: 101 }, (_v, index) => String(index + 1)));
  });

  it("does not send an empty post lookup", async () => {
    const api = createVkApi(config, fakeFetch(() => { throw new Error("must not call"); }));
    expect(await api.getPosts("123", [])).toEqual([]);
  });

  it.each([27, 5, 6, 15, 999])("sanitizes VK error %s including reflected credentials", async (code) => {
    const api = createVkApi(config, fakeFetch(() => response({ error: { error_code: code,
      error_msg: `https://api.vk.com/?access_token=${secret}`, request_params: [{ key: "access_token", value: secret }],
    } })));
    const error = await api.getWall("123", 0, 1).catch((value: unknown) => value as Error);
    expect(error).toBeInstanceOf(Error);
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("request_params");
    expect(serialized).not.toContain("https://api.vk.com");
    expect((error as Error).message).toMatch(/ВК/);
    if (code === 27) expect((error as Error).message).toMatch(/токен.*тип|тип.*токен/i);
  });

  it.each([null, {}, { response: [] }, { response: { count: -1, items: [] } },
    { response: { count: 1, items: [{ ...post, id: "7" }] } },
    { response: { count: 1, items: [{ ...post, text: null }] } },
    { response: { count: 1, items: [{ ...post, attachments: [{ type: "photo", photo: { sizes: [] } }] }] } },
  ])("rejects malformed wall responses safely %#", async (envelope) => {
    const api = createVkApi(config, fakeFetch(() => response(envelope)));
    await expect(api.getWall("123", 0, 1)).rejects.toThrow(/ответ.*ВК|ВК.*ответ/i);
  });

  it.each([{ response: [] }, { response: { groups: [] } }, { response: { groups: [{ id: -123 }] } }])
    ("rejects malformed group responses %#", async (envelope) => {
      await expect(createVkApi(config, fakeFetch(() => response(envelope))).getGroup()).rejects.toThrow(/ВК/);
    });

  it("sanitizes JSON parse and network failures", async () => {
    await expect(createVkApi(config, fakeFetch(() => new Response(secret))).getGroup()).rejects.toThrow(/ответ.*ВК|ВК.*ответ/i);
    const error = await createVkApi(config, fakeFetch(() => { throw new Error(secret); })).getGroup().catch((value) => value as Error);
    expect((error as Error).message).toMatch(/ВК/);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(secret);
  });

  it("sanitizes non-success HTTP status without reading the response body", async () => {
    await expect(createVkApi(config, fakeFetch(() => new Response(secret, { status: 502 }))).getGroup()).rejects.toThrow(/ВК/);
  });

  it("preserves controlled API explanations for callers while hiding arbitrary errors", async () => {
    const error = await createVkApi(config, fakeFetch(() => response({ error: { error_code: 27, error_msg: secret } })))
      .getGroup().catch((value: unknown) => value);
    expect(getVkApiErrorMessage(error)).toMatch(/тип.*токен|токен.*тип/i);
    for (const unsafe of [new Error(secret), secret, { message: secret }, null]) {
      const safe = getVkApiErrorMessage(unsafe);
      expect(safe).toMatch(/ВК/);
      expect(safe).not.toContain(secret);
    }
  });

  it("bounds an unresponsive request and aborts it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const api = createVkApi(config, fakeFetch((_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    }));
    const pending = api.getGroup().catch((error: unknown) => error as Error);
    await vi.advanceTimersByTimeAsync(20000);
    expect(await pending).toBeInstanceOf(Error);
    expect((await pending as Error).message).toMatch(/время|ожидани/i);
    expect(signal?.aborted).toBe(true);
  });

  it.each([["-123", 0, 1], ["123", -1, 1], ["123", 0, 0], ["123", 0.5, 1]])
    ("rejects invalid wall arguments before transport %#", async (group, offset, count) => {
      const api = createVkApi(config, fakeFetch(() => { throw new Error("must not call"); }));
      await expect(api.getWall(String(group), Number(offset), Number(count))).rejects.toThrow(/параметр/i);
    });
});
