import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownRender from "@/components/markdown-render";
import { prepareVkPost } from "./post";
import type { VkPost } from "./types";

const group = { id: "42", name: "Биотех", screenName: "biotech.itmo" };
const tags = [{ id: "education", title: "Образование" }, { id: "science", title: "Наука" }, { id: "legacy", title: "Научные исследования" }];
const cutoff = Date.parse("2026-08-31T21:00:00Z") / 1000;
function post(data: Partial<VkPost> = {}): VkPost {
  return { id: "101", ownerId: "-42", fromId: "-42", date: cutoff, text: "Первая строка\nВторая строка #ОБРАЗОВАНИЕ", isRepost: false, isPinned: false, postType: "post", photos: [], ...data };
}

describe("VK post preparation", () => {
  it("uses exact own-text tags, Moscow publication date, original link and full text", () => {
    const result = prepareVkPost(post(), group, tags);
    expect(result).toMatchObject({ ok: true, title: "Первая строка", date: "2026-09-01", tagIds: ["education"], links: JSON.stringify({ vkLink: "https://vk.ru/wall-42_101" }) });
    if (result.ok) {
      const html = renderToStaticMarkup(<MarkdownRender source={result.text} />);
      expect(html).toContain("Первая строка");
      expect(html).toContain("Вторая строка #ОБРАЗОВАНИЕ");
      expect(html).toContain("<br");
    }
  });
  it.each([
    { date: cutoff - 1 }, { fromId: "7" }, { ownerId: "-43" },
    { isRepost: true }, { postType: "suggest" }, { date: NaN },
  ])("skips unpublished, foreign, old and reposted entries %j", (data) => {
    expect(prepareVkPost(post(data), group, tags).ok).toBe(false);
  });
  it.each(["#Образование", "#ОБРАЗОВАНИЕ@biotech.itmo", "#образование@club42", "#образование@public42"])("accepts current group hashtag %s", (hashtag) => {
    expect(prepareVkPost(post({ text: `Учёба ${hashtag}` }), group, tags)).toMatchObject({ ok: true, title: "Учёба", tagIds: ["education"] });
  });
  it.each(["#Образовательный", "#ОбразованиеДетей", "#Образование研究", "#Образование@foreign", "##Образование", "https://x.test/#Образование", "слово#Образование", "#Научные исследования"])("rejects inexact, foreign and invalid tags %s", (hashtag) => {
    expect(prepareVkPost(post({ text: `Новость ${hashtag}` }), group, tags).ok).toBe(false);
  });
  it("connects every matching tag once and preserves tag spelling in the body", () => {
    expect(prepareVkPost(post({ text: "Новость #Наука #образование #НАУКА" }), group, tags)).toMatchObject({ ok: true, tagIds: ["education", "science"] });
  });
  it("skips hashtag-only lines before selecting a heading and excludes every hashtag", () => {
    expect(prepareVkPost(post({ text: "#образование #чужой\n\n[club42|ИТМО] открывает набор #Наука\nПодробности" }), group, tags)).toMatchObject({ ok: true, title: "ИТМО открывает набор" });
    expect(prepareVkPost(post({ text: "#образование\n#Наука" }), group, tags)).toMatchObject({ ok: false, reason: expect.stringContaining("текста") });
  });
  it("limits headings to 120 characters at a word boundary or hard cuts a long first word", () => {
    const title = "Новости ".repeat(20).trim();
    const first = prepareVkPost(post({ text: `${title}\n#образование` }), group, tags);
    expect(first).toMatchObject({ ok: true, title: "Новости ".repeat(15).trim() });
    expect(prepareVkPost(post({ text: `${"А".repeat(140)} #образование` }), group, tags)).toMatchObject({ ok: true, title: "А".repeat(120) });
    expect(prepareVkPost(post({ text: `${"А".repeat(116)} три дальше #образование` }), group, tags)).toMatchObject({ ok: true, title: `${"А".repeat(116)} три` });
  });
  it("renders arbitrary HTML and markdown as literal text while preserving safe links and VK mentions", () => {
    const result = prepareVkPost(post({ text: 'Набор #Образование\n<script>alert(1)</script> <img src=x onerror=alert(1)>\n[вред](javascript:alert(1)) ![фото](https://evil.test/image)\nhttps://example.org/info?q=1&lang=ru\n[id7|Автор] [https://example.org/path|Подробнее]' }), group, tags);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const html = renderToStaticMarkup(<MarkdownRender source={result.text} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("#Образование");
    expect(html).toContain('href="https://example.org/info?q=1&amp;lang=ru"');
    expect(html).toContain('href="https://vk.ru/id7"');
    expect(html).toContain('href="https://example.org/path"');
  });
});
