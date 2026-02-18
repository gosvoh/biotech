"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

type Props = Omit<HTMLMotionProps<"section">, "children"> & {
  children?: ReactNode;
};

export default function RevealSection({ children, ...props }: Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      {...props}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35, margin: "0px 0px -10% 0px" }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.section>
  );
}
