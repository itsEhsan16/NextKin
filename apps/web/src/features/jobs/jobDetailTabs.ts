/**
 * The detail panel's tabs (redesign R5a, audit JB-07): Overview, Skills and Company. Benefits now
 * sit in Overview, where they were one tab away from a "none listed" for jobs that list them, and
 * Reviews is gone: no data source for reviews exists in V2, so the tab was always empty.
 */
export type JobDetailTab = 'overview' | 'skills' | 'company';

export const JOB_DETAIL_TABS: readonly { id: JobDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills' },
  { id: 'company', label: 'Company' },
];
