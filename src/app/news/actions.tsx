"use server";
import { getPublicNews } from "@/lib/public-news";

export async function getNews(page: number = 0, tags: string[] = []) {
  return getPublicNews(page === 0 ? 3 : 4, page === 0 ? 0 : (page - 1) * 4 + 3, tags);
}
