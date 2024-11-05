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
        "hidden md:flex flex-row gap-2 xl:gap-4 items-center"
      )}
    >
      {items.map((item, i) => (
        <React.Fragment key={`breadcrumb-${i}`}>
          {item.href ? (
            <Link
              className={cn(
                "opacity-50 hover:opacity-100 transition-opacity duration-300 min-w-fit",
                "peer"
              )}
              href={item.href}
            >
              {item.title}
            </Link>
          ) : (
            <p>{item.title}</p>
          )}
          <div
            className={cn(
              "bg-brand3 rounded-full w-2 h-2",
              item.href
                ? "opacity-50 peer-hover:opacity-100 transition-opacity duration-300"
                : ""
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
