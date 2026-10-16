"use client";

import { useCallback, useRef, useState } from "react";
import type { ActionResult } from "./action-result";
import { useAction } from "./use-action";

/** Locks an operation before starting it; independent rows can still be saved. */
export function usePendingAction() {
  const runAction = useAction();
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const isPending = useCallback((key: string) => inFlight.current.has(key), []);
  const run = useCallback(async <T>(
    key: string,
    action: () => Promise<ActionResult<T>>,
    onSuccess?: (value: T) => void,
  ): Promise<ActionResult<T> | undefined> => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPending(new Set(inFlight.current));
    try {
      return await runAction(Promise.resolve().then(action), onSuccess);
    } finally {
      inFlight.current.delete(key);
      setPending(new Set(inFlight.current));
    }
  }, [runAction]);
  return { run, pending, isPending };
}
