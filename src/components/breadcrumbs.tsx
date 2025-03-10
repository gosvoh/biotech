import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

export default function Breadcrumbs({
  items,
}: {
  items: {
    title: string;
    href?: React.ComponentPropsWithoutRef<typeof Link>["href"];
  }[];
}) {
  return (
    <div
      className={cn(
        "text-sm lg:text-base xl:text-xl wrapper w-full",
        "hidden md:flex flex-row gap-2 xl:gap-4 items-center",
        "mb-6"
      )}
    >
      {items.map((item, i) => (
        <div className="group contents" key={`breadcrumb-${i}`}>
          <div
            className={cn(
              "bg-foreground rounded-full w-2 h-2",
              item.href
                ? "opacity-50 group-hover:opacity-100 group-hover:bg-day-primary-violet-hover group-active:bg-day-primary-violet-active transition-all duration-300 bg-opacity-[.04]"
                : ""
            )}
          />
          {item.href ? (
            <Link
              className={cn(
                "opacity-50 group-hover:opacity-100 group-hover:text-day-primary-violet-hover group-active:text-day-primary-violet-active transition-all duration-300 min-w-fit",
                "peer"
              )}
              href={item.href}
            >
              {item.title}
            </Link>
          ) : (
            <p>{item.title}</p>
          )}
        </div>
      ))}
    </div>
  );
}
