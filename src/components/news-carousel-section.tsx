import { Suspense } from "react";
import NewsSkeleton from "./news-skeleton";
import { Button } from "./ui/button";
import { ArrowUpRight } from "lucide-react";
import NewsCarousel from "./news-carousel";
import Link from "next/link";
import { cn } from "@/lib/utils";
import RevealSection from "./reveal-section";

const Btn = ({
  className,
  disabled,
  isLink,
}: React.ComponentProps<typeof Button> & { isLink?: boolean }) => (
  <Button
    asChild
    className={cn("font-bold gap-2", className)}
    disabled={disabled}
  >
    {isLink ? (
      <Link href="/news">
        <ArrowUpRight className="!size-6" /> Все новости
      </Link>
    ) : (
      <>
        <ArrowUpRight className="!size-6" /> Все новости
      </>
    )}
  </Button>
);

export default function NewsCarouselSection({
  className,
  ...props
}: Omit<React.ComponentProps<typeof RevealSection>, "children">) {
  return (
    <RevealSection
      className={cn("section-home-padding overflow-hidden", className)}
      {...props}
    >
      <div className="wrapper">
        <h2>Новости факультета</h2>
        <div className="space-y-6 wrapper overflow-visible">
          <Suspense
            fallback={
              <NewsSkeleton>
                <Btn disabled className="max-md:hidden" />
              </NewsSkeleton>
            }
          >
            <NewsCarousel>
              <Btn isLink className="max-md:hidden" />
            </NewsCarousel>
          </Suspense>
          <Btn isLink className="md:hidden rounded" />
        </div>
      </div>
    </RevealSection>
  );
}
