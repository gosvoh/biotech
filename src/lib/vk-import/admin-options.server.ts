import { prisma } from "@/prisma";
import { revalidate } from "@/lib/utils.server";
import type { VkAutomationOptions } from "./automation";
import type { VkEditorOptions } from "./editor";
import { createVkApi } from "./client";
import { readVkConfig } from "./config";
import { createVkImageStore } from "./images";
import { createNewsPhotoFiles } from "./news-files";

/** Call only after the action's authorization check; manual editing needs no VK config. */
export function createNewsAdminOptions(): VkEditorOptions {
  return { db: prisma, files: createNewsPhotoFiles(), invalidate: () => revalidate("news") };
}

/** Assemble server dependencies per invocation. Never return these options to a client. */
export function createVkAdminOptions(): VkAutomationOptions {
  const { db, files, invalidate } = createNewsAdminOptions();
  return { db, api: createVkApi(readVkConfig()), images: createVkImageStore(), removeOldImages: files.remove, invalidate };
}
