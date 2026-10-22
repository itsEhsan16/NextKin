import { useQuery } from '@tanstack/react-query';

import { repos } from '../repos';

import { qk } from './keys';

/** How often a version still being typeset is asked about again. */
const PENDING_POLL_MS = 2_000;
/** Page links last 15 minutes on the server; refetch well before they stop working. */
const LINKS_FRESH_MS = 10 * 60_000;

/**
 * The typeset pages of a resume version (toreview §111). Pass the card's `currentVersionId`: a new
 * version is a new key, so an edit shows its own pages once they are typeset, and while they are,
 * the server sends the earlier pages flagged `stale`. `structured` (the mock, a cover letter, an open
 * Zero Resume review) tells the screen to draw its own preview.
 */
export function useResumePreview(id: string, versionId?: string) {
  return useQuery({
    queryKey: qk.resumes.preview(id, versionId),
    queryFn: () => repos.resumes.preview(id, versionId),
    enabled: id.length > 0,
    staleTime: LINKS_FRESH_MS,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
  });
}
