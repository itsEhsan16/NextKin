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
type ConsentListener = (retry: () => void) => void;
const consentListeners = new Set<ConsentListener>();

export function onConsentRequired(listener: ConsentListener): () => void {
  consentListeners.add(listener);
  return () => consentListeners.delete(listener);
}

/** A refusal the consent dialog is already handling: screens show no error of their own for it. */
export const isConsentRequired = (error: unknown): boolean => error instanceof ConsentRequiredError;

/** One client per app (or per test); defaults tuned for a mobile, mostly-offline-tolerant app. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, variables, _result, mutation) => {
        if (!(error instanceof ConsentRequiredError)) return;
        const retry = () => void mutation.execute(variables).catch(() => undefined);
        consentListeners.forEach((listener) => listener(retry));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * SECOND,
        gcTime: 5 * MINUTE,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
