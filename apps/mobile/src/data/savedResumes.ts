import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

import { qk } from '@nextkin/shared/queries';

import type { Resume } from './models';
import { createQueryClient } from './queries/client';

/**
 * Saved resumes readable with no connection (toreview §145.5). The phone keeps a copy of the
 * resumes it has already loaded, in the app's private storage, and shows it until the server has
 * answered. It is a copy of what the person could already see, it never replaces the server's, and
 * a sign-out of any kind wipes it.
 */

const KEY = 'offline.resumes';
const SAVE_DELAY_MS = 1000;
/** What reading a resume takes. Typeset pages stay out: their links expire within minutes. */
const SAVED_PARTS: ReadonlySet<unknown> = new Set(['list', 'detail', 'content', 'score', 'sources']);

/** A build reads only its own copy: another version's data may not have the shape it expects. */
const VERSION = Constants.expoConfig?.version;

type SavedCopy = { version: string | undefined; state: DehydratedState };

const isSaved = ({ queryKey }: Query): boolean =>
  queryKey[0] === 'resumes' && SAVED_PARTS.has(queryKey[1]);

/** The resumes still in the list, and nothing about any that has gone from it. */
function save(client: QueryClient): void {
  const list = client.getQueryData<Resume[]>(qk.resumes.list());
  if (!list) return;
  const current = new Set<unknown>(list.map((resume) => resume.id));
  const state = dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' &&
      isSaved(query) &&
      (query.queryKey[2] === undefined || current.has(query.queryKey[2])),
  });
  try {
    // Synchronous so a sign-out straight after can't be overtaken by a write still under way.
    Storage.setItemSync(KEY, JSON.stringify({ version: VERSION, state } satisfies SavedCopy));
  } catch {
    // Only a copy. The next change saves it again.
  }
}

/**
 * The app's query client. `always` keeps today's behaviour with no connection: a request fails and
 * the screen says so. The default would pause it and leave the screen on its skeleton for good.
 * Resumes stay in memory, so the copy keeps what the last save held.
 */
export function createAppQueryClient(): QueryClient {
  const client = createQueryClient();
  const { queries, mutations } = client.getDefaultOptions();
  client.setDefaultOptions({
    queries: { ...queries, networkMode: 'always', refetchOnReconnect: true },
    mutations: { ...mutations, networkMode: 'always' },
  });
  client.setQueryDefaults(['resumes'], { gcTime: Infinity });
  return client;
}

/** Puts the saved copy back before the first screen reads it. */
export function restoreResumes(client: QueryClient): void {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as SavedCopy;
    if (saved.version === VERSION) hydrate(client, saved.state);
  } catch {
    // A damaged copy is no loss: the server has the real one.
  }
}

/** Saves a moment after resume data changes. Returns the way to stop. */
export function keepResumesSaved(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!isSaved(event.query)) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(client), SAVE_DELAY_MS);
  });
  return () => {
    clearTimeout(timer);
    stop();
  };
}

/** Wipes the saved copy. */
export function forgetResumes(): void {
  try {
    Storage.removeItemSync(KEY);
  } catch {
    // Nothing more can be done from here, and a copy that can't be removed can't be read either.
  }
}
