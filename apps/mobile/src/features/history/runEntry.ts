import {
  GENERATION_ACTIVITY_KIND,
  GENERATION_KIND_LABEL,
  generationHint,
  runStartedTitle,
  type ActivityEntry,
  type Generation,
} from '@/data/models';

/**
 * A run that hasn't finished, as a History row (V2 §7.2, toreview §145.3). It opens the run's own
 * screen, where a live run is watched and a failed one is tried again. A failed row uses the bell's
 * words, and its time is when it stopped.
 */
export function runEntry(run: Generation, document: string | undefined): ActivityEntry {
  const failed = run.status === 'failed';
  const name = document ?? run.title ?? GENERATION_KIND_LABEL[run.kind];
  return {
    id: run.id,
    kind: GENERATION_ACTIVITY_KIND[run.kind],
    title: failed ? `**${name}** didn’t finish` : runStartedTitle(run.kind, document, run.title),
    detail: failed ? run.error : generationHint(run),
    createdAt: failed ? run.updatedAt : run.startedAt,
    deepLink: `/generations/${run.id}`,
  };
}
