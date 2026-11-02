import type { QueryClient } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';

import { createQueryClient } from './queries/client';

/**
 * Resumes are not kept on the phone (owner, 2026-11-02, toreview §148.1; supersedes §145.5). A resume
 * opens from the server, and with no connection the screen says so.
 */

/** Where Step 2's offline copy lived, on phones that ran it. */
const OLD_COPY_KEY = 'offline.resumes';

/**
 * The app's query client. `always` keeps today's behaviour with no connection: a request fails and
 * the screen says so. The default would pause it and leave the screen on its skeleton for good.
 */
export function createAppQueryClient(): QueryClient {
  const client = createQueryClient();
  const { queries, mutations } = client.getDefaultOptions();
  client.setDefaultOptions({
    queries: { ...queries, networkMode: 'always', refetchOnReconnect: true },
    mutations: { ...mutations, networkMode: 'always' },
  });
  return client;
}

/** Removes a copy an earlier build saved, so no resume text stays on the phone. */
export function clearOldResumeCopy(): void {
  try {
    Storage.removeItemSync(OLD_COPY_KEY);
  } catch {
    // A copy that can't be removed can't be read either: nothing reads it any more.
  }
}
