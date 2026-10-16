import { revalidateTag } from "next/cache";
import type { ActionResult } from "./action-result";

/**
 * Narrows a raw `FormData` entry to an optional string, returning `undefined`
 * for missing values, files, or empty strings.
 */
export function getOptionalString(
  value: FormDataEntryValue | null
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Legacy guards retain full-admin semantics; section editors use explicit guards. */
export { requireFullAdmin as requireAdmin, requireFullAdminPage as requireAdminPage } from "./admin-access.server";

export function revalidate(tagToRevalidate: string | string[]) {
  if (Array.isArray(tagToRevalidate))
    tagToRevalidate.forEach((tag) => revalidateTag(tag, { expire: 0 }));
  else revalidateTag(tagToRevalidate, { expire: 0 });
}

/**
 * Wraps a server action body so failures (validation, authorization, database)
 * are returned as `{ ok: false, error }` instead of thrown. Next.js masks the
 * messages of thrown server-action errors in production; returning them as data
 * lets the client show the real message. Use together with {@link useAction}.
 */
export async function actionResult<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Произошла ошибка",
    };
  }
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
