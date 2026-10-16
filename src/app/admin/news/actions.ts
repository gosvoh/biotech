"use server";

import { requireAdminSection } from "@/lib/admin-access.server";

import { actionResult } from "@/lib/utils.server";
import { deleteNewsWithDecisions, duplicateNewsWithPhotos, setNewsVisibility } from "@/lib/vk-import/editor";
import { createNewsAdminOptions } from "@/lib/vk-import/admin-options.server";

export async function deleteNews(id: string) { return actionResult(async () => { await requireAdminSection("news"); await deleteNewsWithDecisions(createNewsAdminOptions(), id); }); }
export async function changeVisibility(id: string, hidden: boolean) { return actionResult(async () => { await requireAdminSection("news"); return setNewsVisibility(createNewsAdminOptions(), id, hidden); }); }
export async function duplicateNews(id: string) { return actionResult(async () => { await requireAdminSection("news"); return duplicateNewsWithPhotos(createNewsAdminOptions(), id); }); }
