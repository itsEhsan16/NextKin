/**
 * The detail panel's five tabs as the board draws them (304:2723), back at the owner's word
 * (2026-11-13: "I like this design, so bring it back"). Benefits lists the job's benefits (or its
 * perks); Reviews says plainly that none exist yet, since V2 has no source for them.
 */
export type JobDetailTab = 'overview' | 'about' | 'skills' | 'benefits' | 'reviews';

export const JOB_DETAIL_TABS: readonly { id: JobDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'reviews', label: 'Reviews' },
];
