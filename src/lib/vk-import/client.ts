import type { VkApi, VkPhoto, VkPost } from "./types";
import type { VkConfig } from "./config";

// VKCOM/vk-api-schema (5.199): groups.getById -> { groups }, wall.getById -> { items }.
const API_VERSION = "5.199";
const REQUEST_TIMEOUT_MS = 15000;

const errors = {
  invalidResponse: "ВК вернул некорректный ответ. Повторите проверку позже.",
  parameters: "Некорректные параметры запроса к ВК.",
  network: "Не удалось подключиться к ВК. Повторите проверку позже.",
  unavailable: "Сервис ВК временно недоступен. Повторите проверку позже.",
  timeout: "Время ожидания ответа ВК истекло. Повторите проверку позже.",
  rejected: "ВК отклонил запрос. Повторите проверку позже.",
  token: "ВК отклонил токен. Проверьте VK_GROUP_TOKEN в настройках сервера.",
  rateLimit: "Слишком много запросов к ВК. Повторите проверку позже.",
  access: "ВК запретил доступ. Проверьте доступ токена к сообществу.",
  tokenType: "Этот тип токена ВК не поддерживает метод. Используйте токен с доступом к чтению стены.",
  source: "ВК отклонил параметры запроса. Проверьте настройки источника.",
  communityAccess: "Нет доступа к сообществу ВК. Проверьте настройки источника и токен.",
};

export class VkApiError extends Error {}

/** Only messages produced at this boundary are safe for administrative output. */
export function getVkApiErrorMessage(error: unknown): string {
  return error instanceof VkApiError && Object.values(errors).includes(error.message)
    ? error.message : errors.network;
}

function invalidResponse(): never {
  throw new VkApiError(errors.invalidResponse);
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalidResponse();
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum?: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (minimum !== undefined && value < minimum)) invalidResponse();
  return value;
}

function ownerId(value: unknown): string {
  const id = integer(value);
  if (id === 0) invalidResponse();
  return String(id);
}

function string(value: unknown): string {
  if (typeof value !== "string") invalidResponse();
  return value;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidResponse();
  return value;
}

function flag(value: unknown): boolean {
  if (value === undefined || value === 0 || value === false) return false;
  if (value === 1 || value === true) return true;
  return invalidResponse();
}

function photos(attachments: unknown): VkPhoto[] {
  return list(attachments ?? []).flatMap((value) => {
    const attachment = record(value);
    const type = string(attachment.type);
    if (type !== "photo") return [];
    const sizes = list(record(attachment.photo).sizes);
    if (sizes.length === 0) invalidResponse();
    const candidates = sizes.map((value) => {
      const size = record(value);
      const url = string(size.url);
      const width = integer(size.width, 0);
      const height = integer(size.height, 0);
      // Download safety (host, redirects, size and MIME type) belongs to the image store.
      if (!url.startsWith("https://")) invalidResponse();
      return { url, area: width * height };
    });
    const largest = candidates.reduce((best, size) => size.area > best.area ? size : best);
    return [{ url: largest.url }];
  });
}

function normalizePost(value: unknown): VkPost {
  const post = record(value);
  return {
    id: String(integer(post.id, 1)),
    ownerId: ownerId(post.owner_id),
    fromId: ownerId(post.from_id),
    date: integer(post.date, 0),
    text: string(post.text),
    postType: string(post.post_type),
    isPinned: flag(post.is_pinned),
    isRepost: list(post.copy_history ?? []).length > 0,
    photos: photos(post.attachments),
  };
}

function apiError(value: unknown): VkApiError {
  const code = record(value).error_code;
  const messages: Record<number, string> = {
    5: errors.token,
    6: errors.rateLimit,
    15: errors.access,
    27: errors.tokenType,
    100: errors.source,
    203: errors.communityAccess,
  };
  return new VkApiError(typeof code === "number" && Number.isSafeInteger(code)
    ? messages[code] ?? errors.rejected
    : errors.rejected);
}

function positiveId(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function invalidParameters(): never {
  throw new VkApiError(errors.parameters);
}

/** Fetch-only boundary. Eligibility and publication decisions belong to the importer. */
export function createVkApi(config: VkConfig, fetcher: typeof fetch = fetch): VkApi {
  async function request(method: "groups.getById" | "wall.get" | "wall.getById", parameters: Record<string, string>): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new VkApiError(errors.timeout));
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    });
    const perform = async () => {
      let response: Response;
      try {
        response = await fetcher(`https://api.vk.com/method/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ ...parameters, access_token: config.token, v: API_VERSION }).toString(),
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        throw new VkApiError(errors.network);
      }
      if (!response.ok) throw new VkApiError(errors.unavailable);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        invalidResponse();
      }
      const envelope = record(payload);
      if ("error" in envelope) throw apiError(envelope.error);
      if (!("response" in envelope)) invalidResponse();
      return envelope.response;
    };
    try {
      return await Promise.race([perform(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getGroup() {
      const groupId = /^-?\d+$/.test(config.group) ? String(Math.abs(Number(config.group))) : config.group;
      const response = record(await request("groups.getById", { group_ids: groupId }));
      const groups = list(response.groups);
      if (groups.length !== 1) invalidResponse();
      const group = record(groups[0]);
      const screenName = string(group.screen_name);
      if (!/^[a-z\d_.]+$/i.test(screenName)) invalidResponse();
      return { id: String(integer(group.id, 1)), name: string(group.name), screenName };
    },
    async getWall(groupId, offset, count) {
      if (!positiveId(groupId) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(count) || count < 1) invalidParameters();
      const response = record(await request("wall.get", {
        owner_id: `-${groupId}`, offset: String(offset), count: String(Math.min(count, 100)), filter: "all",
      }));
      return { count: integer(response.count, 0), items: list(response.items).map(normalizePost) };
    },
    async getPosts(groupId, postIds) {
      if (!positiveId(groupId) || postIds.some((id) => !positiveId(id))) invalidParameters();
      const posts: VkPost[] = [];
      for (let start = 0; start < postIds.length; start += 100) {
        const ids = postIds.slice(start, start + 100).map((id) => `-${groupId}_${id}`).join(",");
        const response = record(await request("wall.getById", { posts: ids }));
        posts.push(...list(response.items).map(normalizePost));
      }
      return posts;
    },
  };
}
