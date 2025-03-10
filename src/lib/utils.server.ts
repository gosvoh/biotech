import { revalidateTag } from "next/cache";

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
