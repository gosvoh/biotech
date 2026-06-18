import { revalidateTag } from "next/cache";
import { auth } from "@/auth";

/**
 * Narrows a raw `FormData` entry to an optional string, returning `undefined`
 * for missing values, files, or empty strings.
 */
export function getOptionalString(
  value: FormDataEntryValue | null
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

function revalidate(tagToRevalidate: string | string[]) {
  if (Array.isArray(tagToRevalidate))
    tagToRevalidate.forEach((tag) => revalidateTag(tag, { expire: 0 }));
  else revalidateTag(tagToRevalidate, { expire: 0 });
}

/**
 * Runs a database action, then invalidates the given cache tag(s).
 * Resolves to nothing - use {@link dbActionWithResult} when the caller
 * needs the action's resolved value.
 */
export async function dbAction(
  action: Promise<unknown>,
  tagToRevalidate: string | string[]
): Promise<void> {
  await action;
  revalidate(tagToRevalidate);
}

/**
 * Runs a database action, then invalidates the given cache tag(s),
 * resolving to the action's value with its precise type preserved.
 */
export async function dbActionWithResult<T>(
  action: Promise<T>,
  tagToRevalidate: string | string[]
): Promise<T> {
  const data = await action;
  revalidate(tagToRevalidate);
  return data;
}
