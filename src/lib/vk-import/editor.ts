import type { News, Prisma, PrismaClient } from "@/lib/db/client";
import { newsImagesOrderBy } from "@/lib/news-order";
import type { NewsPhotoFiles } from "./news-files";
import type { PreparedVkImage } from "./types";

export interface VkEditorOptions {
  db: PrismaClient;
  files: NewsPhotoFiles;
  invalidate: () => void | Promise<void>;
}

class EditorError extends Error {}
const NOT_FOUND = "Новость не найдена.";
const STORAGE_ERROR = "Не удалось сохранить решение редактора. Повторите попытку.";
const CACHE_ERROR = "Изменения сохранены, но кеш не обновлён. Повторите проверку новостей.";
const SOURCE_CHANGED = "Исходная новость изменилась во время копирования. Повторите попытку.";

async function transaction<T>(db: PrismaClient, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try { return await db.$transaction(action); }
  catch (error) {
    if (error instanceof EditorError) throw error;
    throw new EditorError(STORAGE_ERROR);
  }
}

async function markRevalidation(tx: Prisma.TransactionClient, groupId: string | undefined) {
  if (groupId) await tx.vkImportSource.update({ where: { groupId }, data: { needsRevalidate: true, revalidationRevision: { increment: 1 } } });
}

async function invalidateSaved(options: VkEditorOptions) {
  try { await options.invalidate(); }
  catch { throw new EditorError(CACHE_ERROR); }
  // Source checks drain needsRevalidate while holding their lease. Clearing it
  // here could erase another editor's concurrent committed invalidation.
}

export async function setNewsVisibility(options: VkEditorOptions, newsId: string, hidden: boolean): Promise<News> {
  const news = await transaction(options.db, async tx => {
    const current = await tx.news.findUnique({ where: { id: newsId }, include: { vkImport: true } });
    if (!current) throw new EditorError(NOT_FOUND);
    const ledger = current.vkImport;
    const clearAutomaticReason = ledger?.syncEnabled === false && hidden === false;
    if (ledger) {
      await tx.vkImportPost.update({
        where: { groupId_postId: { groupId: ledger.groupId, postId: ledger.postId } },
        data: { manualHidden: hidden, ...(clearAutomaticReason ? { autoHiddenReason: null } : {}), revision: { increment: 1 } },
      });
    }
    const result = await tx.news.update({
      where: { id: newsId }, data: { hidden: hidden || (!clearAutomaticReason && ledger?.autoHiddenReason != null) },
    });
    await markRevalidation(tx, ledger?.groupId);
    return result;
  });
  await invalidateSaved(options);
  return news;
}

export async function deleteNewsWithDecisions(options: VkEditorOptions, newsId: string): Promise<void> {
  const images = await transaction(options.db, async tx => {
    const current = await tx.news.findUnique({ where: { id: newsId }, include: { vkImport: true, images: true } });
    if (!current) throw new EditorError(NOT_FOUND);
    const ledger = current.vkImport;
    if (ledger) {
      // The journal survives News deletion via SetNull. Record the exclusion
      // and increment its decision version before removing the related row.
      await tx.vkImportPost.update({
        where: { groupId_postId: { groupId: ledger.groupId, postId: ledger.postId } },
        data: { manualDeleted: true, deletionRetry: false, deletionRetryAt: null, revision: { increment: 1 } },
      });
    }
    await tx.news.delete({ where: { id: newsId } });
    await markRevalidation(tx, ledger?.groupId);
    return current.images.map(image => ({ id: image.id }));
  });
  let cleanupFailed = false;
  try { await options.files.remove(images); }
  catch { cleanupFailed = true; }
  await invalidateSaved(options);
  if (cleanupFailed) throw new EditorError("Новость удалена, но не все фотографии удалось удалить.");
}

export async function restoreVkPostExclusion(options: VkEditorOptions, groupId: string, postId: string): Promise<void> {
  await transaction(options.db, async tx => {
    const key = { groupId, postId };
    const ledger = await tx.vkImportPost.findUnique({ where: { groupId_postId: key } });
    if (!ledger) throw new EditorError("Исключённый пост не найден.");
    await tx.vkImportPost.update({
      where: { groupId_postId: key },
      data: { manualDeleted: false, deletionRetry: false, deletionRetryAt: null, ...(ledger.newsId === null ? { status: "pending" } : {}), revision: { increment: 1 } },
    });
    await markRevalidation(tx, groupId);
  });
  await invalidateSaved(options);
}

export async function disableVkSync(options: VkEditorOptions, newsId: string): Promise<News> {
  const news = await transaction(options.db, async tx => {
    const current = await tx.news.findUnique({ where: { id: newsId }, include: { vkImport: true } });
    if (!current) throw new EditorError(NOT_FOUND);
    const ledger = current.vkImport;
    if (!ledger) throw new EditorError("Эта новость не связана с импортом ВК.");
    await tx.vkImportPost.update({
      where: { groupId_postId: { groupId: ledger.groupId, postId: ledger.postId } },
      data: { syncEnabled: false, deletionRetry: false, deletionRetryAt: null, revision: { increment: 1 } },
    });
    await markRevalidation(tx, ledger.groupId);
    return tx.news.findUniqueOrThrow({ where: { id: newsId } });
  });
  await invalidateSaved(options);
  return news;
}

const duplicateInclude = {
  vkImport: true,
  tags: { orderBy: { id: "asc" as const } },
  images: { orderBy: newsImagesOrderBy },
} satisfies Prisma.NewsInclude;
type DuplicateSource = Prisma.NewsGetPayload<{ include: typeof duplicateInclude }>;

function sourceFingerprint(source: DuplicateSource): string {
  return JSON.stringify({
    id: source.id, title: source.title, text: source.text, links: source.links,
    date: source.date, hidden: source.hidden, updatedAt: source.updatedAt.toISOString(),
    tags: source.tags.map(tag => tag.id),
    images: source.images.map(image => ({ id: image.id, sortOrder: image.sortOrder, updatedAt: image.updatedAt.toISOString() })),
    vkRevision: source.vkImport?.revision ?? null,
  });
}

export async function duplicateNewsWithPhotos(options: VkEditorOptions, newsId: string): Promise<News> {
  let source: DuplicateSource | null;
  try { source = await options.db.news.findUnique({ where: { id: newsId }, include: duplicateInclude }); }
  catch { throw new EditorError(STORAGE_ERROR); }
  if (!source) throw new EditorError(NOT_FOUND);
  const expected = sourceFingerprint(source);
  let copies: PreparedVkImage[];
  try { copies = await options.files.clone(source.images); }
  catch { throw new EditorError("Не удалось скопировать все фотографии. Исходная новость сохранена."); }
  let duplicate: News;
  try {
    duplicate = await transaction(options.db, async tx => {
      const current = await tx.news.findUnique({ where: { id: newsId }, include: duplicateInclude });
      if (!current || sourceFingerprint(current) !== expected) throw new EditorError(SOURCE_CHANGED);
      const created = await tx.news.create({
        data: {
          title: current.title, text: current.text, links: current.links, date: current.date, hidden: true,
          tags: { connect: current.tags.map(tag => ({ id: tag.id })) },
          images: { create: copies.map(image => ({ id: image.id, sortOrder: image.sortOrder })) },
        },
      });
      await markRevalidation(tx, current.vkImport?.groupId);
      return created;
    });
  } catch (error) {
    try { await options.files.remove(copies); }
    catch { throw new EditorError("Копия не сохранена, но не все временные фотографии удалось удалить."); }
    throw error;
  }
  // These files belong to the committed draft, including after cache failure.
  await invalidateSaved(options);
  return duplicate;
}
