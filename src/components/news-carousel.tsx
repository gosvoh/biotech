import {
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  Carousel as EmblaCarousel,
} from "@/components/ui/carousel";
import Image from "next/image";
import { unstable_cache as cache } from "next/cache";

import { cn } from "@/lib/utils";
import { prisma } from "@/prisma";

import dayjs from "@/lib/dayjs";
import NewsCard from "./news-card";

const getNews = cache(
  () =>
    prisma.news.findMany({
      select: {
        id: true,
        date: true,
        title: true,
        images: { select: { id: true } },
      },
      where: { hidden: false },
      take: 10,
    }),
  ["news"],
  {
    revalidate: 60,
    tags: ["news"],
  }
);

const CarouselImage = ({
  src,
  date,
  title,
  className,
}: {
  src: React.ComponentProps<typeof Image>["src"];
  date: string;
  title: string;
  className?: string;
}) => (
  <CarouselItem
    className={cn(
      "md:basis-3/4 xl:basis-2/5 min-h-350px max-md:pl-10 pl-6",
      className
    )}
  >
    <NewsCard date={date} imageSrc={src} title={title} />
  </CarouselItem>
);

export default async function NewsCarousel({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const news = await getNews();

  return (
    <EmblaCarousel
      opts={{
        breakpoints: {
          "(max-width: 767px)": { align: "center" },
          "(min-width: 768px)": { align: "start" },
        },
      }}
      className={cn(
        "w-full h-full flex flex-col gap-6 overflow-visible",
        className
      )}
    >
      <CarouselContent
        className="flex-1 max-md:-ml-10 -ml-6 overflow-visible"
        wrapperClassName="md:overflow-visible"
      >
        {news.map((x) => (
          <CarouselImage
            key={`news-${x.id}`}
            src={`/uploads/news/${x.images[0]?.id}.webp`}
            date={dayjs(x.date).format("LL")}
            title={x.title}
          />
        ))}
      </CarouselContent>
      <div className="flex flex-row justify-center gap-4 items-center md:justify-between">
        {children}
        <div className="flex flex-row justify-center gap-4 items-center">
          <CarouselPrevious
            variant={"default"}
            className="disabled:bg-card disabled:text-foreground disabled:opacity-100"
          />
          <CarouselNext
            variant={"default"}
            className="disabled:bg-card disabled:text-foreground disabled:opacity-100"
          />
        </div>
      </div>
    </EmblaCarousel>
  );
}
