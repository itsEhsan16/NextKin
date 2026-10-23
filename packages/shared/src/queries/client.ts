import { QueryClient } from '@tanstack/react-query';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** One client per app (or per test); defaults tuned for a mobile, mostly-offline-tolerant app. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
