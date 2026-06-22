"use client";

import { App } from "antd";
import { useCallback } from "react";
import type { ActionResult } from "./action-result";

/**
 * Returns a runner for admin server actions that return an {@link ActionResult}.
 * On `{ ok: true }` it runs the optional `onSuccess` callback (reset a form,
 * close a modal, navigate); on `{ ok: false }` it surfaces the action's error
 * through Ant Design's message API. A rejected promise (e.g. a network failure)
 * is also caught and reported.
 *
 * Must be used under an Ant Design `<App>` provider (set up in the admin layout).
 */
export function useAction() {
  const { message } = App.useApp();

  return useCallback(
    async <T>(
      action: Promise<ActionResult<T>>,
      onSuccess?: (value: T) => void
    ): Promise<ActionResult<T>> => {
      try {
        const result = await action;
        if (result.ok) onSuccess?.(result.data);
        else message.error(result.error);
        return result;
      } catch {
        const error = "Произошла ошибка";
        message.error(error);
        return { ok: false, error };
      }
    },
    [message]
  );
}
