"use server";

import { prisma } from "@/prisma";

export async function getNews(page: number = 0, tags: string[] = []) {
  const select = {
    date: true,
    id: true,
    tags: true,
    title: true,
  };
  const where = {
    hidden: false,
    tags: tags.length ? { some: { id: { in: tags } } } : undefined,
  };

  return prisma.$transaction([
    prisma.news.findMany({
      select,
      where,
      skip: page === 0 ? 0 : (page - 1) * 4 + 3,
      take: page === 0 ? 3 : 4,
    }),
    prisma.news.count({ where }),
  ]);
}
