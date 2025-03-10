import { Suspense } from "react";
import NewsSkeleton from "./news-skeleton";
import { Button } from "./ui/button";
import { ArrowUpRight } from "lucide-react";
import NewsCarousel from "./news-carousel";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function NewsCarouselSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("section-home-padding overflow-hidden", className)}
      {...props}
    >
      <div className="wrapper">
        <h2>Новости факультета</h2>
        <div className="space-y-6 wrapper overflow-visible">
          <Suspense
            fallback={
              <NewsSkeleton>
                <Button
                  className="md:text-lg xl:text-xl gap-[10px] md:gap-4 max-md:hidden"
                  disabled
                >
                  <ArrowUpRight /> Все новости
                </Button>
              </NewsSkeleton>
            }
          >
            <NewsCarousel>
              <Button
                asChild
                className="md:text-lg xl:text-xl gap-[10px] md:gap-4 max-md:hidden"
              >
                <Link href="/news">
                  <ArrowUpRight /> Все новости
                </Link>
              </Button>
            </NewsCarousel>
          </Suspense>
          <Button
            asChild
            className="md:text-lg xl:text-xl gap-[10px] md:gap-4 md:hidden"
          >
            <Link href="/news">
              <ArrowUpRight /> Все новости
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
