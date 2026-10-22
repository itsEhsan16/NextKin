/** The detail panel's 5-tab bar (304:2723). Only Overview has content drawn on the board. */
export type JobDetailTab = 'overview' | 'about' | 'skills' | 'benefits' | 'reviews';

export const JOB_DETAIL_TABS: readonly { id: JobDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'reviews', label: 'Reviews' },
];
