/**
 * NextKin V2 spec §7.2 — the audit trail behind the dashboard's "Activities" counter, surfaced
 * as the History feed (plan phase 9I). No artboard exists for it.
 *
 * `ActivityEntry` is deliberately `Notification`'s sibling: one rich line with `**bold**` runs
 * instead of a title/body pair, and a deep link that always points at the exact destination.
 * Keep the two in step — a History row and its notification describe the same event.
 */

/** What happened. One kind per thing the app records; `ACTIVITY_FILTERS` groups these. */
export type ActivityKind =
  | 'generation'
  | 'score'
  | 'export'
  | 'application'
  | 'saved_job'
  | 'profile'
  | 'cover_letter'
  | 'ats_check'
  | 'interview'
  | 'plan';

/** Row eyebrow / filter-chip copy. Short nouns, the vocabulary the rest of the app already uses. */
export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  generation: 'Generation',
  score: 'ATS score',
  export: 'Export',
  application: 'Application',
  saved_job: 'Saved job',
  profile: 'Profile',
  cover_letter: 'Cover letter',
  ats_check: 'ATS check',
  interview: 'Interview prep',
  plan: 'Plan & billing',
};

/** FontAwesome 5 Solid glyph names for the leading tile (same tile as a notification's glyph). */
export const ACTIVITY_KIND_ICON: Record<ActivityKind, string> = {
  generation: 'magic',
  score: 'bullseye',
  export: 'file-download',
  application: 'paper-plane',
  saved_job: 'bookmark',
  profile: 'user-edit',
  cover_letter: 'envelope',
  ats_check: 'clipboard-check',
  interview: 'comments',
  plan: 'credit-card',
};

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  /**
   * One rich line, `**bold**` runs render semibold — parse with `parseBold`, the same
   * convention `Notification.body` uses.
   */
  title: string;
  /** Optional second line: the quiet detail (score delta, file name, stage). */
  detail?: string;
  /** ISO-8601 */
  createdAt: string;
  /** expo-router href; every row deep-links to its exact destination, never a tab root. */
  deepLink?: string;
  /** Set when the entry is about one resume, so History can filter to a document. */
  resumeId?: string;
  /** Set when the entry is about one job. */
  jobId?: string;
};

/**
 * The History screen's pills. Nine kinds would not fit a row, so they fold into three groups plus
 * "All" — and every kind lands in exactly one group, which a test asserts, because a kind that
 * matched no pill would vanish from every filtered view without anyone noticing.
 */
export type ActivityFilter = 'all' | 'documents' | 'jobs' | 'account';

export const ACTIVITY_FILTERS: readonly {
  key: ActivityFilter;
  label: string;
  kinds?: readonly ActivityKind[];
}[] = [
  { key: 'all', label: 'All' },
  {
    key: 'documents',
    label: 'Documents',
    kinds: ['generation', 'score', 'export', 'cover_letter', 'ats_check', 'interview'],
  },
  { key: 'jobs', label: 'Jobs', kinds: ['application', 'saved_job'] },
  { key: 'account', label: 'Account', kinds: ['profile', 'plan'] },
];

export function matchesActivityFilter(entry: ActivityEntry, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  const group = ACTIVITY_FILTERS.find((item) => item.key === filter);
  return group?.kinds?.includes(entry.kind) ?? false;
}
