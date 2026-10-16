import type { Prisma, PrismaClient } from "@/lib/db/client";
import { VkHistoryError } from "./history";
import type { VkHistoryDetailsPage } from "./types";

const PAGE_SIZE = 20;
// Prisma's skip is a signed 32-bit integer. Reject overflow before querying.
const MAX_PAGE = Math.floor(2_147_483_647 / PAGE_SIZE);

export async function listVkHistoryDetails(db: PrismaClient, input: unknown): Promise<VkHistoryDetailsPage> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new VkHistoryError("Укажите задание, страницу и фильтр истории.");
  const { jobId, page, filter } = input as Record<string, unknown>;
  if (typeof jobId !== "string" || !jobId.trim() || jobId.length > 128) throw new VkHistoryError("Укажите задание истории.");
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) throw new VkHistoryError("Укажите допустимый номер страницы.");
  if (filter !== "all" && filter !== "skipped" && filter !== "failed") throw new VkHistoryError("Укажите допустимый фильтр истории.");
  return db.$transaction(async (tx) => {
    const job = await tx.vkHistoryJob.findUnique({ where: { id: jobId }, select: { groupId: true } });
    if (!job) throw new VkHistoryError("Операция истории не найдена.");
    const where: Prisma.VkHistoryPostWhereInput = { jobId, ...(filter === "failed" ? { state: "failed" } : filter === "skipped" ? { state: "done", outcome: "skipped" } : {}) };
    const total = await tx.vkHistoryPost.count({ where });
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
    // jobId + postId is the primary key; postId ordering has no ties within a job.
    const rows = await tx.vkHistoryPost.findMany({ where, orderBy: { postId: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { postId: true, state: true, outcome: true, reasonCode: true, reasonText: true },
    });
    return { items: rows.map((row) => ({ ...row,
      sourceUrl: /^[1-9]\d*$/.test(job.groupId) && /^[1-9]\d*$/.test(row.postId) ? `https://vk.com/wall-${job.groupId}_${row.postId}` : null,
      reasonText: row.reasonText ?? "Подробная причина не сохранена для этой записи",
    })), total, page: currentPage, pageSize: PAGE_SIZE };
  });
}
