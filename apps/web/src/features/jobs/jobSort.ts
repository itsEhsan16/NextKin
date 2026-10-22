import { JOB_SORT_LABEL, type JobSort } from '@nextkin/shared/models';

/**
 * The web board names the default sort "Most relevant" (304:2447); mobile's board names the same
 * sort "Relevance" (1:326). Same ordering, different copy — so the override lives here, not in
 * the shared model mobile reads.
 */
export const WEB_JOB_SORT_LABEL: Record<JobSort, string> = {
  ...JOB_SORT_LABEL,
  relevance: 'Most relevant',
};
