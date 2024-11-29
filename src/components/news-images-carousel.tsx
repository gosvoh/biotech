"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { NewsImages } from "@/lib/db/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React from "react";

export default function NewsImageCarousel({
  images,
  newsTitle,
  className,
}: {
  images: NewsImages[];
  newsTitle: string;
  className?: string;
}) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{
        breakpoints: {
          "(max-width: 767px)": { align: "center", loop: false },
          "(min-width: 768px)": { align: "center", loop: true },
        },
      }}
      className={className}
    >
      <CarouselContent wrapperClassName="max-lg:overflow-visible">
        {images.map((image, index) => (
          <CarouselItem
            key={`news-image-${image.id}`}
            className="max-md:basis-3/4"
          >
            <Image
              src={`/uploads/news/${image.id}.webp`}
              alt={`${newsTitle} image ${index + 1}`}
              width={1000}
              height={800}
              className="object-cover rounded-2.75xl aspect-square md:aspect-video w-full max-md:max-h-[350px]"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="max-lg:hidden absolute -left-[68px] top-1/2 -translate-y-1/2" />
      <CarouselNext className="max-lg:hidden absolute -right-[68px] top-1/2 -translate-y-1/2" />
      <div className="max-md:hidden flex justify-center items-center gap-3 h-6 mt-6">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "w-4 h-4 rounded-full bg-news-carousel-button/60",
              "hover:bg-news-carousel-button focus:bg-news-carousel-button",
              "transition-all duration-300",
              current === index + 1 ? "bg-news-carousel-button w-6 h-6" : ""
            )}
          >
            <span className="sr-only">{`Slide ${index + 1}`}</span>
          </button>
        ))}
      </div>
    </Carousel>
  );
}
