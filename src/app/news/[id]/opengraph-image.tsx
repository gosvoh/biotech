import { generateOGImage } from "@/lib/meta";
import { getNews } from "./page";
import { notFound } from "next/navigation";

export const alt = "Новости";
export const size = {
  width: 1920,
  height: 960,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const news = await getNews((await params).id);

  if (!news || news.hidden) return notFound();

  return generateOGImage(`Новость: ${news.title}`, { fontSize: 100 });
}
