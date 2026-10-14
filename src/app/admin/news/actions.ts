"use server";

import { actionResult, requireAdmin, revalidate } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import { deleteNewsWithDecisions, duplicateNewsWithPhotos, setNewsVisibility } from "@/lib/vk-import/editor";
import { createNewsPhotoFiles } from "@/lib/vk-import/news-files";

function options() { return { db: prisma, files: createNewsPhotoFiles(), invalidate: () => revalidate("news") }; }
export async function deleteNews(id: string) { return actionResult(async () => { await requireAdmin(); await deleteNewsWithDecisions(options(), id); }); }
export async function changeVisibility(id: string, hidden: boolean) { return actionResult(async () => { await requireAdmin(); return setNewsVisibility(options(), id, hidden); }); }
export async function duplicateNews(id: string) { return actionResult(async () => { await requireAdmin(); return duplicateNewsWithPhotos(options(), id); }); }
