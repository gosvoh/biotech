import { parseNewsTagTitle, type NewsTagName } from "@/lib/news-tags";
import type { VkGroup, VkPost } from "./types";

const FIRST_PUBLICATION = Date.parse("2026-08-31T21:00:00Z") / 1000;

// Consume the whole Unicode hashtag, including an optional community suffix.
// This prevents an allowed tag from matching the prefix of a longer word.
function hashtags(text: string) {
  return [...text.matchAll(/(?<![\p{L}\p{N}\p{M}_#/:])#([\p{L}\p{N}\p{M}_]+)(?:@([A-Za-z0-9_.-]+))?/gu)];
}

function escapeText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]{}()#+.!|~-]/g, "\\$&");
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href.replace(/[<>"\\()]/g, (character) => encodeURIComponent(character));
  } catch { return null; }
}

/** VK supplies plain text, so source Markdown/HTML must remain plain text. */
export function vkTextToMarkdown(text: string): string {
  const tokens = /\[((?:id|club|public)\d+|https?:\/\/[^\s|\]]+)\|([^\]\n]+)\]|https?:\/\/[^\s<>"\]]+/g;
  let result = "";
  let position = 0;
  for (const match of text.matchAll(tokens)) {
    result += escapeText(text.slice(position, match.index));
    const mention = match[1];
    let value = mention ?? match[0];
    let trailing = "";
    if (!mention) {
      // Sentence punctuation belongs to the text, rather than to the URL.
      const ending = value.match(/[.,!?;:]+$/)?.[0] ?? "";
      value = value.slice(0, value.length - ending.length);
      trailing = ending;
    }
    const url = safeUrl(mention && /^(id|club|public)\d+$/.test(mention) ? `https://vk.ru/${mention}` : value);
    result += url ? `[${escapeText(match[2] ?? value)}](<${url}>)${escapeText(trailing)}` : escapeText(match[0]);
    position = match.index + match[0].length;
  }
  result += escapeText(text.slice(position));
  return result.replace(/\r\n?/g, "\n").replace(/\n/g, "  \n");
}

function heading(text: string): string | null {
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    let clean = line;
    for (const match of hashtags(line).reverse()) clean = clean.slice(0, match.index) + clean.slice(match.index + match[0].length);
    clean = clean.replace(/\[(?:id\d+|club\d+|public\d+|https?:\/\/[^|\]]+)\|([^\]]+)\]/g, "$1").replace(/\s+/g, " ").trim();
    if (!clean || /^[\s.,:;|—–-]+$/.test(clean)) continue;
    if (clean.length <= 120) return clean;
    const cut = clean.slice(0, 120);
    if (/\s/.test(clean[120])) return cut.trimEnd();
    const boundary = cut.lastIndexOf(" ");
    return boundary > 0 ? cut.slice(0, boundary) : cut;
  }
  return null;
}

export function prepareVkPost(post: VkPost, group: VkGroup, tags: readonly NewsTagName[]):
  | { ok: true; title: string; text: string; date: string; tagIds: string[]; links: string }
  | { ok: false; reason: string } {
  if (post.ownerId !== `-${group.id}` || post.fromId !== `-${group.id}`) return { ok: false, reason: "Пост опубликован не от имени сообщества" };
  if (post.isRepost) return { ok: false, reason: "Репосты не импортируются" };
  if (post.postType !== "post") return { ok: false, reason: "Пост ещё не опубликован" };
  if (!Number.isSafeInteger(post.date) || post.date < FIRST_PUBLICATION) return { ok: false, reason: "Пост опубликован раньше 1 сентября 2026 года" };
  const suffixes = new Set([group.screenName.toLowerCase(), `club${group.id}`, `public${group.id}`]);
  const found = new Set(hashtags(post.text).filter((match) => !match[2] || suffixes.has(match[2].toLowerCase())).map((match) => match[1].toLowerCase()));
  const tagIds = tags.filter((tag) => {
    const parsed = parseNewsTagTitle(tag.title);
    return parsed.ok && parsed.title === tag.title && found.has(parsed.normalizedTitle);
  }).map((tag) => tag.id);
  if (!tagIds.length) return { ok: false, reason: "Нет совпадений с тегами сайта" };
  const title = heading(post.text);
  if (!title) return { ok: false, reason: "В посте нет содержательного текста" };
  return {
    ok: true, title, text: vkTextToMarkdown(post.text), tagIds,
    date: new Date((post.date + 3 * 3600) * 1000).toISOString().slice(0, 10),
    links: JSON.stringify({ vkLink: `https://vk.ru/wall-${group.id}_${post.id}` }),
  };
}
