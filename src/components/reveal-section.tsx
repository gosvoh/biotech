"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

export default function RevealSection({
  children,
  ...props
}: React.ComponentPropsWithoutRef<"section"> &
  HTMLMotionProps<"section"> & {
    children?: ReactNode;
  }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <section {...props}>{children}</section>;

  return (
    <motion.section
      {...props}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}
