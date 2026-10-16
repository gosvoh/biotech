import { AsyncLocalStorage } from "node:async_hooks";

export type AuthMailOutcome = "sent" | "rate-limited" | "unavailable" | "failed";
const observations = new AsyncLocalStorage<{ outcome: AuthMailOutcome }>();

/** Internal per-invocation observer. No request parameter enables trusted feedback. */
export function getAuthMailObserver(): (outcome: AuthMailOutcome) => void {
  const observation = observations.getStore();
  return (outcome) => { if (observation) observation.outcome = outcome; };
}

/** Auth.js's neutral redirect cannot distinguish a sent mail from a quota rejection. */
export async function observeAuthMailDelivery(send: () => Promise<unknown>): Promise<AuthMailOutcome> {
  const observation = { outcome: "failed" as AuthMailOutcome };
  return observations.run(observation, async () => {
    try { await send(); } catch { /* Expose a safe delivery result, never SMTP internals. */ }
    return observation.outcome;
  });
}
