import { prisma } from "@/prisma";
import dayjs from "@/lib/dayjs";
import { newsImagesOrderBy } from "@/lib/news-order";

export async function getPublicNews(take: number, skip = 0, tags: string[] = []) {
  const where = {
    hidden: false,
    tags: tags.length ? { some: { id: { in: tags } } } : undefined,
  };

  return prisma.$transaction(async (tx) => {
    // Legacy editor dates are RFC strings; imported dates use YYYY-MM-DD.
    // Sort parsed dates before pagination, loading only IDs/dates for the full list.
    const dates = await tx.news.findMany({ where, select: { id: true, date: true } });
    const ranked = dates.map((item) => ({
      id: item.id,
      time: dayjs(item.date).valueOf(),
    }));
    ranked.sort((a, b) => {
      const aTime = Number.isFinite(a.time) ? a.time : -Infinity;
      const bTime = Number.isFinite(b.time) ? b.time : -Infinity;
      return (aTime === bTime ? 0 : bTime - aTime) || b.id.localeCompare(a.id);
    });
    const ids = ranked.slice(skip, skip + take).map((item) => item.id);
    const news = await tx.news.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        date: true,
        title: true,
        tags: true,
        images: { select: { id: true }, orderBy: newsImagesOrderBy },
      },
    });
    const positions = new Map(ids.map((id, index) => [id, index]));
    news.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
    return [news, dates.length] as const;
  });
}
