import {
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  Carousel as EmblaCarousel,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import NewsCardSkeleton from "./news-card-skeleton";

export default function NewsSkeleton({ children }: React.PropsWithChildren) {
  return (
    <EmblaCarousel
      opts={{
        breakpoints: {
          "(max-width: 767px)": { align: "center" },
          "(min-width: 768px)": { align: "start" },
        },
      }}
      className={cn("w-full h-full flex flex-col gap-6 overflow-visible")}
    >
      <CarouselContent className="flex-1 max-md:-ml-10 -ml-6 overflow-visible">
        {Array.from({ length: 10 }).map((_, i) => (
          <CarouselItem
            key={`news-skeleton-${i}`}
            className="md:basis-3/4 xl:basis-2/5 min-h-350px max-md:pl-10 pl-6"
          >
            <NewsCardSkeleton />
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex flex-row justify-center gap-4 items-center md:justify-between">
        {children}
        <div className="flex flex-row justify-center gap-4 items-center">
          <CarouselPrevious
            variant={"default"}
            className="disabled:bg-card disabled:text-foreground disabled:opacity-100"
            disabled
          />
          <CarouselNext
            variant={"default"}
            className="disabled:bg-card disabled:text-foreground disabled:opacity-100"
            disabled
          />
        </div>
      </div>
    </EmblaCarousel>
  );
}
