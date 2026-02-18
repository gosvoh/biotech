import { revalidateTag } from "next/cache";
import { auth } from "@/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

export function dbAction<T>(
  action: Promise<T>,
  tagToRevalidate: string | string[],
  returnValue?: boolean
) {
  return action
    .then((data) => {
      if (Array.isArray(tagToRevalidate))
        tagToRevalidate.forEach((tag) => revalidateTag(tag, "max"));
      else revalidateTag(tagToRevalidate, "max");
      return data;
    })
    .then((data) => (returnValue ? data : true));
}
