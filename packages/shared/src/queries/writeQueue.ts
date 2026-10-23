import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Options for the writes to one piece of state that saves as it changes, such as a settings card.
 * Spread them into each of those writes' `useMutation` options.
 *
 * The shared scope queues the writes, so they reach the server in the order they were made: the
 * mock's latency is random, and without the queue an earlier change could land last and undo a
 * later one. The shared key is how `refetchWhenQueueEmpty` sees what's still waiting.
 */
export function writeQueue(id: string) {
  return { mutationKey: ['write-queue', id], scope: { id } } as const;
}

/**
 * The `onSettled` of a queued write: refetch only once nothing else is waiting. TanStack starts a
 * scope's next write only after this one's `onSettled` resolves, so a refetch in between would
 * bring back the server's copy without that write's change, and the control just changed would
 * flip back until its own save landed. `isMutating` still counts the write that is settling.
 */
export function refetchWhenQueueEmpty(queryClient: QueryClient, id: string, queryKey: QueryKey) {
  const waiting = queryClient.isMutating({ mutationKey: writeQueue(id).mutationKey }) > 1;
  return waiting ? undefined : queryClient.invalidateQueries({ queryKey });
}

/**
 * The `onError` of a queued, optimistic patch: puts back only the fields this write changed. A
 * queued write takes its snapshot when it is made, before the writes ahead of it have landed, so
 * restoring the whole snapshot would also undo their changes, or bring back one that failed.
 */
export function rollBackPatch<T extends object>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  patch: Partial<T>,
  previous: T | undefined,
) {
  if (!previous) return;
  const keys = Object.keys(patch) as (keyof T)[];
  queryClient.setQueryData<T>(queryKey, (current) => {
    if (!current) return current;
    const restored = { ...current };
    for (const key of keys) restored[key] = previous[key];
    return restored;
  });
}
