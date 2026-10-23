import { extractJdDraft, newId, simulate, SKILL_DICTIONARY } from '@/data/mock';
import type { JdDraft } from '@/data/models';

import { clone, findOrThrow, type MockStore } from './state';
import type { JdRepo } from './types';

/**
 * NextKin V2 spec §7.5 — JD upload, extraction and the review screen.
 *
 * The extraction itself is pure and lives in `@/data/mock/jdExtractor`; this repo is only the
 * part a server would own — identity, the clock and the saved draft — so swapping it for
 * `POST /jd/extract` later changes nothing above it.
 */

/**
 * Extraction is the heaviest step in the intake flow and the only one whose progress copy has
 * something to say ("Reading the description…"), so it gets its own latency band instead of the
 * 300–900ms default: a result that lands before the sentence explaining it can be read is a
 * flicker, not a step.
 */
const EXTRACT_LATENCY = { minMs: 1200, maxMs: 2200 };

export function createMockJdRepo(store: MockStore): JdRepo {
  const find = (id: string): JdDraft => findOrThrow(store.state.jdDrafts, id, 'JdDraft');

  return {
    extract: (input) =>
      simulate(() => {
        const draft = extractJdDraft(input, {
          jobs: store.state.jobs,
          dictionary: SKILL_DICTIONARY,
          // Ids and timestamps come from here so the extractor stays pure and testable.
          id: newId('jd'),
          now: new Date().toISOString(),
        });
        // Newest first: the JD history opens on the extraction the user just made.
        store.state.jdDrafts = [clone(draft), ...store.state.jdDrafts];
        return clone(draft);
      }, EXTRACT_LATENCY),

    get: (id) => simulate(() => clone(find(id))),

    update: (id, patch) =>
      simulate(() => {
        // What the review screen confirms is what generation, scoring and cover letters read,
        // so the patch is cloned in rather than held by reference (V2 §7.5).
        const updated: JdDraft = { ...find(id), ...clone(patch) };
        store.state.jdDrafts = store.state.jdDrafts.map((draft) =>
          draft.id === id ? updated : draft,
        );
        return clone(updated);
      }),
  };
}
