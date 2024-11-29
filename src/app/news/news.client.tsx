"use client";

import NewsCard from "@/components/news-card";
import Tag from "@/components/tag";
import { Button } from "@/components/ui/button";
import type { NewsTags } from "@/lib/db/client";
import { useImmer } from "use-immer";
import dayjs from "@/lib/dayjs";
import { useEffect, useState } from "react";
import { getNews } from "./actions";
import NewsCardSkeleton from "@/components/news-card-skeleton";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function NewsClient({ newsTags }: { newsTags: NewsTags[] }) {
  const searchParams = useSearchParams();
  const [selectedTags, setSelectedTags] = useImmer<string[]>(() => {
    const tags = searchParams.get("tags");
    return tags ? tags.split(",") : [];
  });
  const [filteredNews, setFilteredNews] = useImmer<
    Awaited<ReturnType<typeof getNews>>[0]
  >([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getNews(page, selectedTags).then((data) => {
      const [news, total] = data;
      setTotal(total);
      setFilteredNews((draft) => {
        if (page === 0) draft.splice(0, draft.length);
        draft.push(...news);
      });
    });
  }, [page, selectedTags, setFilteredNews]);

  return (
    <div className="space-y-10">
      <div className="flex gap-2 md:gap-4 flex-wrap justify-center">
        <Tag
          className="bg-accent hover:bg-accent/90 text-white"
          onClick={() => {
            setPage(0);
            setSelectedTags([]);
          }}
        >
          Все новости
        </Tag>
        {newsTags.map((tag) => (
          <Tag
            key={`tag-${tag.id}`}
            active={selectedTags.includes(tag.id)}
            onClick={() => {
              setPage(0);
              setSelectedTags((ids) =>
                ids.includes(tag.id)
                  ? ids.filter((id) => id !== tag.id)
                  : [...ids, tag.id]
              );
            }}
          >
            {tag.title}
          </Tag>
        ))}
      </div>
      <div className="gap-6 grid grid-cols-1 lg:grid-cols-2 lg:max-w-3/4 mx-auto">
        {filteredNews.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <NewsCardSkeleton
              className="lg:first:col-span-2"
              key={`news-skeleton-${i}`}
            />
          ))}
        {filteredNews.map((item) => (
          <Link
            key={`news-${item.id}`}
            href={`/news/${item.id}`}
            className="lg:first:col-span-2"
          >
            <NewsCard
              date={dayjs(item.date).format("LL")}
              imageSrc={`/uploads/news/${item.images[0]?.id}.webp`}
              title={item.title}
            />
          </Link>
        ))}
      </div>
      {filteredNews.length < total && (
        <Button
          onClick={() => setPage((page) => page + 1)}
          className="mx-auto block bg-card text-black"
        >
          Показать ещё
        </Button>
      )}
    </div>
  );
}
