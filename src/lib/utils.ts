import { clsx, type ClassValue } from "clsx";
import { revalidateTag } from "next/cache";
import type React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Функция для получения текста, в котором убраны висячие предлоги и союзы
 * @argument text - текст, в котором нужно убрать висячие предлоги и союзы
 * @returns текст без висячих предлогов и союзов с неразрывными пробелами
 */
export function removeHangingPrepositionsAndConjunctions(
  text: TemplateStringsArray | string | React.ReactElement
): string {
  if (typeof text === "string") {
    return text.replace(/(\s[а-яё]{1,3})\s/gi, "$1\u00A0");
  }
  if (Array.isArray(text)) {
    return text.join("").replace(/(\s[а-яё]{1,3})\s/gi, "$1\u00A0");
  }
  if (typeof text === "object" && "props" in text) {
    const textString = (text.props as React.PropsWithChildren)
      .children as string;
    return textString.replace(/(\s[а-яё]{1,3})\s/gi, "$1\u00A0");
  }
  return "ERROR REMOVE HANGING PREPOSITIONS AND CONJUNCTIONS";
}

export function dbAction<T>(
  action: Promise<T>,
  tagToRevalidate: string | string[],
  returnValue?: boolean
) {
  return action
    .then((data) => {
      if (Array.isArray(tagToRevalidate))
        tagToRevalidate.forEach((tag) => revalidateTag(tag));
      else revalidateTag(tagToRevalidate);
      return data;
    })
    .then((data) => (returnValue ? data : true));
}
