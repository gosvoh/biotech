export function normalizeNewsTagTitle(title: string): string {
  return title.startsWith("#") && !title.startsWith("##") ? title.slice(1) : title;
}

export function parseNewsTagTitle(value: unknown):
  | { ok: true; title: string; normalizedTitle: string }
  | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "Укажите название тега" };
  const title = normalizeNewsTagTitle(value);
  if (!title) return { ok: false, error: "Укажите название тега" };
  if (title.length > 30) return { ok: false, error: "Название тега должно содержать не больше 30 символов" };
  if (/[^A-Za-zА-Яа-яЁё0-9_]/u.test(title)) {
    return { ok: false, error: "Используйте русские и латинские буквы, цифры и _. Пробелы и дефисы запрещены" };
  }
  return { ok: true, title, normalizedTitle: title.toLowerCase() };
}

export type NewsTagName = { id: string; title: string };
export const DUPLICATE_NEWS_TAG_ERROR = "Тег с таким названием уже существует";

export function getNewsTagError(value: unknown, tags: readonly NewsTagName[], ownId?: string): string | undefined {
  const parsed = parseNewsTagTitle(value);
  if (!parsed.ok) return parsed.error;
  if (tags.some((tag) => tag.id !== ownId && normalizeNewsTagTitle(tag.title).toLowerCase() === parsed.normalizedTitle)) {
    return DUPLICATE_NEWS_TAG_ERROR;
  }
}

export function getStoredNewsTagIssue(tag: NewsTagName, tags: readonly NewsTagName[]): string | undefined {
  const parsed = parseNewsTagTitle(tag.title);
  if (!parsed.ok) return parsed.error;
  if (parsed.title !== tag.title) return "Удалите начальный # из сохранённого названия";
  return getNewsTagError(tag.title, tags, tag.id);
}
