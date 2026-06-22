/**
 * Discriminated result returned by every admin server action. Errors are sent
 * as data (not thrown) so the exact message survives Next.js's production
 * masking of thrown server-action errors and can be shown to the user.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
