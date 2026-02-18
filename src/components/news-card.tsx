import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import Reveal from "./reveal";

export default function NewsCard({
  imageSrc,
  date,
  title,
  className,
  classNames,
  href,
  headerLevel = 3,
}: {
  imageSrc?: React.ComponentProps<typeof Image>["src"];
  date: string;
  title: string;
  className?: string;
  classNames?: {
    root?: string;
    image?: string;
    date?: string;
    title?: string;
  };
  href?: string;
  headerLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const content = (
    <>
      {imageSrc && (
        <div className="relative rounded-2.75xl aspect-square md:aspect-video w-full max-md:max-h-[300px] overflow-hidden">
          <Image
            src={imageSrc}
            alt={`Изображение новости ${title}`}
            className={cn("object-cover", classNames?.image)}
            fill
            sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 48vw, (min-width: 768px) 70vw, 92vw"
            quality={88}
          />
        </div>
      )}
      <div className="space-y-4">
        <p className={classNames?.date}>{date}</p>
        {React.createElement(
          `h${headerLevel}`,
          { className: classNames?.title },
          title,
        )}
      </div>
    </>
  );

  if (href)
    return (
      <Reveal className="w-full contents">
        <Link
          className={cn(
            "border-2 border-border rounded-2.75xl p-10 space-y-6 w-full transition-border",
            "hover:border-accent block",
            className,
            classNames?.root,
          )}
          href={href}
        >
          {content}
        </Link>
      </Reveal>
    );

  return (
    <Reveal className="w-full contents">
      <div
        className={cn(
          "border-2 border-border rounded-2.75xl p-10 space-y-6 w-full transition-border",
          "hover:border-accent",
          className,
          classNames?.root,
        )}
      >
        {content}
      </div>
    </Reveal>
  );
}
