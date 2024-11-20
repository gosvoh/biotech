"use client";

import Image from "next/image";
import Landing from "@public/landing.png";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";

export default function FigureImage({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Carousel
        className="absolute top-0 left-0 max-w-11/40 overflow-hidden rounded-full aspect-square"
        opts={{ loop: true, watchDrag: false, watchFocus: false }}
        plugins={[Autoplay({ delay: 1900 })]}
      >
        <CarouselContent className="flex-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <CarouselItem key={i} className="ml-0 pl-0">
              <Image
                src={`/landing${i + 1}.webp`}
                alt=""
                width={300}
                height={300}
                className="aspect-square object-cover"
                loading="eager"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <Carousel
        className="absolute bottom-0 right-0 max-w-11/40 overflow-hidden rounded-full aspect-square"
        opts={{
          loop: true,
          watchDrag: false,
          watchFocus: false,
          startIndex: 3,
          containScroll: false,
        }}
        plugins={[Autoplay({ delay: 2100 }), Fade({ active: true })]}
      >
        <CarouselContent className="flex-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <CarouselItem key={i} className="ml-0 pl-0">
              <Image
                src={`/landing${i + 1}.webp`}
                alt=""
                width={300}
                height={300}
                className="aspect-square object-cover"
                loading="eager"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <Image src={Landing} alt="" priority />
    </div>
  );
}
