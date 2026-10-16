import { describe, expect, it } from "vitest";
import { VK_FIRST_DAY, VK_FIRST_PUBLICATION_SECONDS, VK_TIME_ZONE } from "./policy";
import { prepareVkPost } from "./post";
import type { VkPost } from "./types";

const group = { id: "42", name: "Тестовое сообщество", screenName: "test.community" };
const tags = [{ id: "science", title: "Наука" }];
const post = (date: number): VkPost => ({
  id: "1", ownerId: "-42", fromId: "-42", date, text: "Новость #Наука",
  isRepost: false, isPinned: false, postType: "post", photos: [],
});

describe("VK publication policy", () => {
  it("defines the first day and Moscow time zone", () => {
    expect(VK_FIRST_DAY).toBe("2026-09-01");
    expect(VK_TIME_ZONE).toBe("Europe/Moscow");
  });

  it("derives the cutoff from midnight in Moscow", () => {
    expect(new Date(VK_FIRST_PUBLICATION_SECONDS * 1000).toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(new Intl.DateTimeFormat("sv-SE", { timeZone: VK_TIME_ZONE }).format(new Date(VK_FIRST_PUBLICATION_SECONDS * 1000))).toBe("2026-09-01");
  });

  it("rejects a publication one second before the cutoff", () => {
    expect(prepareVkPost(post(Date.parse("2026-08-31T20:59:59Z") / 1000), group, tags)).toMatchObject({ ok: false });
  });

  it("accepts a publication exactly at midnight on the first day", () => {
    expect(prepareVkPost(post(Date.parse("2026-08-31T21:00:00Z") / 1000), group, tags)).toMatchObject({ ok: true, date: "2026-09-01" });
  });
});
