import { parseNewsTagTitle, type NewsTagName } from "@/lib/news-tags";
import type { VkGroup, VkPost, VkSelectionBasis } from "./types";

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

/** The spelling of a publication basis survives catalog rename and deletion. */
export function getVkHashtags(text: string, group: VkGroup): Set<string> {
  const suffixes = new Set([group.screenName.toLowerCase(), `club${group.id}`, `public${group.id}`]);
  return new Set(hashtags(text).filter((match) => !match[2] || suffixes.has(match[2].toLowerCase())).map((match) => match[1].toLowerCase()));
}

export function getStoredVkSelectionBasis(value: unknown): VkSelectionBasis[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item)
    && typeof item.name === "string" && typeof item.tagId === "string" && item.name && item.tagId
    ? [{ name: item.name.toLowerCase(), tagId: item.tagId }] : []);
}

export function getVkSelectionBasis(text: string, group: VkGroup, tags: readonly NewsTagName[]): VkSelectionBasis[] {
  const found = getVkHashtags(text, group);
  return tags.flatMap((tag) => {
    const parsed = parseNewsTagTitle(tag.title);
    return parsed.ok && parsed.title === tag.title && found.has(parsed.normalizedTitle)
      ? [{ name: parsed.normalizedTitle, tagId: tag.id }] : [];
  });
}

export function prepareVkPost(post: VkPost, group: VkGroup, tags: readonly NewsTagName[], savedBasis: readonly VkSelectionBasis[] = []):
  | { ok: true; title: string; text: string; date: string; tagIds: string[]; links: string; selectionBasis: VkSelectionBasis[] }
  | { ok: false; reason: string } {
  if (post.ownerId !== `-${group.id}` || post.fromId !== `-${group.id}`) return { ok: false, reason: "Пост опубликован не от имени сообщества" };
  if (post.isRepost) return { ok: false, reason: "Репосты не импортируются" };
  if (post.postType !== "post") return { ok: false, reason: "Пост ещё не опубликован" };
  if (!Number.isSafeInteger(post.date) || post.date < FIRST_PUBLICATION) return { ok: false, reason: "Пост опубликован раньше 1 сентября 2026 года" };
  const found = getVkHashtags(post.text, group);
  const selectionBasis = [...savedBasis];
  for (const item of getVkSelectionBasis(post.text, group, tags)) {
    if (!selectionBasis.some((old) => old.name === item.name && old.tagId === item.tagId)) selectionBasis.push(item);
  }
  const matching = selectionBasis.filter((item) => found.has(item.name));
  if (!matching.length) return { ok: false, reason: "Нет совпадений с тегами сайта или сохранённым основанием публикации" };
  const available = new Set(tags.map((tag) => tag.id));
  const tagIds = [...new Set(matching.map((item) => item.tagId).filter((id) => available.has(id)))];
  const title = heading(post.text);
  if (!title) return { ok: false, reason: "В посте нет содержательного текста" };
  return {
    ok: true, title, text: vkTextToMarkdown(post.text), tagIds, selectionBasis,
    date: new Date((post.date + 3 * 3600) * 1000).toISOString().slice(0, 10),
    links: JSON.stringify({ vkLink: `https://vk.ru/wall-${group.id}_${post.id}` }),
  };
}
