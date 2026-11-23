import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ConsentRequiredError } from '../repos/state';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * AI work refused for want of consent (P12-12), from any mutation in the app: the consent dialog
 * each app mounts listens here, so no screen has to handle it on its own. It is handed `retry`,
 * which runs the refused mutation again with the same input, so once the person agrees the action
 * they asked for carries on — the screen's own callbacks included (toreview §114).
 */
/**
 * `retry` re-runs the refused request after consent; null when the screen opted out of that
 * (`meta.consentRetry: false`), so the dialog can say "try that again now" instead (§262).
 */
type ConsentListener = (retry: (() => void) | null) => void;
const consentListeners = new Set<ConsentListener>();

export function onConsentRequired(listener: ConsentListener): () => void {
  consentListeners.add(listener);
  return () => consentListeners.delete(listener);
}

/** A refusal the consent dialog is already handling: screens show no error of their own for it. */
export const isConsentRequired = (error: unknown): boolean => error instanceof ConsentRequiredError;

/**
 * One retry for a request that might succeed a second time (a dropped connection, a 5xx, a 408 or
 * 429) and none for one that can't (§196): a 404 or a validation refusal answers the same again,
 * so retrying only held the error state back by a second.
 */
export function retryOnce(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== 'number') return true;
  return status >= 500 || status === 408 || status === 429;
}

/** One client per app (or per test); defaults tuned for a mobile, mostly-offline-tolerant app. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, variables, _result, mutation) => {
        if (!(error instanceof ConsentRequiredError)) return;
        // A screen that has already told the user the request failed opts out of the quiet re-run
        // (`meta.consentRetry: false`): otherwise the change lands after "it failed" was said, with
        // no before/after to undo it (toreview §260). The dialog still opens; they ask again.
        const retry =
          mutation.options.meta?.consentRetry === false
            ? null
            : () => void mutation.execute(variables).catch(() => undefined);
        consentListeners.forEach((listener) => listener(retry));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * SECOND,
        // Long enough that a screen opened again later in the session draws from memory instead
        // of a skeleton (§191). Stale data still refetches in the background as before.
        gcTime: 30 * MINUTE,
        retry: retryOnce,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
