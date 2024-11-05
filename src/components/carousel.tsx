import {
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  Carousel as EmblaCarousel,
} from "@/components/ui/carousel";
import Image, { StaticImageData } from "next/image";

import TestImage from "@public/landing1.png";
import { cn } from "@/lib/utils";

const CarouselImage = ({
  src,
  date,
  title,
  className,
}: {
  src: StaticImageData;
  date: string;
  title: string;
  className?: string;
}) => (
  <CarouselItem
    className={cn("md:basis-3/4 xl:basis-2/5 min-h-350px", className)}
  >
    <div className="border border-border rounded-2.75xl p-10 space-y-6">
      <Image
        src={src}
        alt=""
        className="h-full object-cover rounded-2.75xl aspect-square md:aspect-video"
      />
      <div className="space-y-4">
        <p className="text-brand3 text-xl">{date}</p>
        <h3 className="text-2xl text-accent-carbon">{title}</h3>
      </div>
    </div>
  </CarouselItem>
);

export default function Carousel({ children }: React.PropsWithChildren) {
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
        {Array.from({ length: 20 }).map((_, i) => (
          <CarouselImage
            key={i}
            src={TestImage}
            className="max-md:pl-10 pl-6"
            date="14 сентября"
            title="День Открытых Дверей программы магистратуры «ФудТех»"
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
