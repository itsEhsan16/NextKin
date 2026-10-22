import type { ApplicationWithJob, EmploymentType, RemoteType } from '@nextkin/shared/models';

import { isWithin, type TimeWindow } from '@/lib/timeWindow';

/**
 * The five chips over the list (286:1282). "Time period" is how long ago the application went in;
 * "More filters" holds the workplace type.
 */
export type ApplicationFilters = {
  appliedWithin?: TimeWindow;
  employmentTypes: EmploymentType[];
  companies: string[];
  locations: string[];
  remote: RemoteType[];
};

export const EMPTY_APPLICATION_FILTERS: ApplicationFilters = {
  employmentTypes: [],
  companies: [],
  locations: [],
  remote: [],
};

/**
 * Filtered here rather than in the repo: all of an account's applications arrive in one call, as
 * they do for mobile's Applied tab, so there is no page of results to narrow on the server.
 */
export function matchesApplicationFilters(
  { application, job }: ApplicationWithJob,
  filters: ApplicationFilters,
  now = Date.now(),
): boolean {
  if (filters.appliedWithin && !isWithin(application.appliedAt, filters.appliedWithin, now))
    return false;
  if (filters.employmentTypes.length > 0 && !filters.employmentTypes.includes(job.employmentType))
    return false;
  if (filters.companies.length > 0 && !filters.companies.includes(job.company)) return false;
  if (filters.locations.length > 0 && !filters.locations.includes(job.location)) return false;
  if (filters.remote.length > 0 && !filters.remote.includes(job.remote)) return false;
  return true;
}

/** "Sort by: Most recent" (304:2892). The board draws only the default; the other two are ours. */
export type ApplicationSort = 'recent' | 'oldest' | 'company';

export const APPLICATION_SORT_LABEL: Record<ApplicationSort, string> = {
  recent: 'Most recent',
  oldest: 'Oldest first',
  company: 'Company A–Z',
};

const byAppliedDesc = (a: ApplicationWithJob, b: ApplicationWithJob): number =>
  b.application.appliedAt.localeCompare(a.application.appliedAt);

export const APPLICATION_COMPARATORS: Record<
  ApplicationSort,
  (a: ApplicationWithJob, b: ApplicationWithJob) => number
> = {
  recent: byAppliedDesc,
  oldest: (a, b) => byAppliedDesc(b, a),
  company: (a, b) => a.job.company.localeCompare(b.job.company) || byAppliedDesc(a, b),
};
