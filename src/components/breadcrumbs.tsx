import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import { ChevronRight } from "lucide-react";

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
        "text-sm lg:text-base wrapper w-full",
        "hidden md:flex flex-row gap-2 items-center",
        "mb-6",
      )}
    >
      {items.map((item, i) => (
        <React.Fragment key={`breadcrumb-${i}`}>
          <div className="group flex flex-row items-center gap-1">
            {/* <div
              className={cn(
                "bg-foreground rounded-full w-2 h-2",
                item.href
                  ? "opacity-50 group-hover:opacity-100 group-hover:bg-day-primary-violet-hover group-active:bg-day-primary-violet-active transition-all duration-300 bg-opacity-[.04]"
                  : ""
              )}
            /> */}
            {item.href ? (
              <Link
                className={cn(
                  "opacity-50 group-hover:opacity-100 group-hover:text-day-primary-violet-hover group-active:text-day-primary-violet-active transition-all duration-300 min-w-fit",
                  "peer",
                )}
                href={item.href}
              >
                {item.title}
              </Link>
            ) : (
              <p className="text-sm lg:text-base">{item.title}</p>
            )}
          </div>
          {i !== items.length - 1 && (
            <ChevronRight className="opacity-50 w-4 h-4" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
