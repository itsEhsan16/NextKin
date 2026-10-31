import { memo, useMemo } from 'react';

import type { ActivityEntry, Generation } from '@/data/models';
import { useGeneration, useResumes } from '@/data/queries';

import { runEntry } from '../runEntry';
import { ActivityRow } from './ActivityRow';

export type RunRowProps = {
  run: Generation;
  onOpen: (entry: ActivityEntry) => void;
};

/**
 * One run in History's "Not finished" group, drawn as an ordinary feed card. Watching the run keeps
 * its stage current, and refreshes the list when it ends. A run that lands while this is open goes
 * with that refresh, so there is nothing to draw for it in between.
 */
export const RunRow = memo(function RunRow({ run, onOpen }: RunRowProps) {
  const current = useGeneration(run.id).data ?? run;
  const resumes = useResumes();
  const documentId = current.resumeId ?? current.sourceResumeId;
  const document = resumes.data?.find((resume) => resume.id === documentId)?.title;
  const entry = useMemo(() => runEntry(current, document), [current, document]);

  if (current.status === 'ready') return null;
  return <ActivityRow entry={entry} onOpen={onOpen} />;
});
