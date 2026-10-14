export interface VkConfig {
  group: string;
  token: string;
}

type VkEnvironment = Record<string, string | undefined>;

function readGroup(env: VkEnvironment): string {
  const group = env.VK_GROUP_ID?.trim();
  if (!group) throw new Error("Укажите VK_GROUP_ID в настройках сервера для подключения ВК.");
  const numeric = /^-?\d+$/.test(group);
  const valid = numeric
    ? Number.isSafeInteger(Number(group)) && Number(group) !== 0
    : /^[a-z][a-z\d_.]{0,254}$/i.test(group);
  if (!valid) throw new Error("VK_GROUP_ID должен содержать ID или короткое имя сообщества ВК.");
  return group;
}

/** Server credentials only. Do not pass the returned config to client components. */
export function readVkConfig(env: VkEnvironment = process.env): VkConfig {
  const group = readGroup(env);
  const token = env.VK_GROUP_TOKEN?.trim();
  if (!token) throw new Error("Укажите VK_GROUP_TOKEN в настройках сервера для подключения ВК.");
  if (/\s/.test(token)) throw new Error("VK_GROUP_TOKEN имеет некорректный формат.");
  return { group, token };
}

/** A safe administrative view; configured means env is present, not verified API access. */
export function getVkConfigStatus(env: VkEnvironment = process.env): {
  configured: boolean;
  source: string | null;
  error: string | null;
} {
  let source: string | null = null;
  try {
    source = readGroup(env);
    readVkConfig(env);
    return { configured: true, source, error: null };
  } catch (error) {
    return { configured: false, source, error: (error as Error).message };
  }
}
