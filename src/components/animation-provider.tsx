"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

export default function AnimationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [elements, setElements] = useState<Element[]>([]);

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main || pathname.startsWith("/admin")) return;

    const elements = [...main.getElementsByTagName("*")].filter(
      (x) => x.tagName !== "DIV"
    );

    elements.forEach((el) => el.classList.add("opacity-0"));

    setElements(elements);
  }, [pathname]);

  useEffect(() => {
    const observers = elements.map((el) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              el.classList.remove("opacity-0");
            }, 100);
          }
        });
      });

      observer.observe(el);

      return observer;
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [pathname, elements, elements.length]);

  return <>{children}</>;
}
