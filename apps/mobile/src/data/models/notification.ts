/** NextKin V2 spec §10 — Notifications aggregate, reshaped to NOTIF 01–07. */

/** The five push categories NOTIF 04 offers — "Five categories, deliberately." */
export type NotificationCategory = 'matches' | 'closing' | 'applications' | 'ai' | 'billing';

/** Leading 40pt tile on a feed row (Figma 1:2423 / 1:2439 / 1:2446 / 1:2455). */
export type NotificationVisual =
  /** Brand sparkle tile — the daily matches digest. */
  | { kind: 'sparkle' }
  /** Company monogram tile. */
  | { kind: 'logo'; company: string }
  /** FA5 glyph tile in one of the artboard's three tints. */
  | { kind: 'glyph'; icon: string; tone: 'brand' | 'warning' | 'neutral' };

export type Notification = {
  id: string;
  category: NotificationCategory;
  /**
   * One rich line, not a title/body pair (Figma 1:2425): `**bold**` runs render semibold.
   * Parse with `parseBold` from @/lib.
   */
  body: string;
  /** ISO-8601 */
  createdAt: string;
  read: boolean;
  /**
   * In-app destination (expo-router href). Canvas note 1:2497: every row deep-links to its
   * exact destination — job detail, score panel, plan screen — never a tab root.
   */
  deepLink?: string;
  visual: NotificationVisual;
  /** Matches-digest extras: stacked company initials + overflow (Figma 1:2426–1:2433). */
  stack?: { initials: string[]; more?: number };
};

export type NotificationCategoryMeta = {
  key: NotificationCategory;
  /** Preferences row title (Figma 1:2719). */
  label: string;
  /** Preferences row caption. */
  description: string;
  /** "AI results ready" carries the AI badge (Figma 1:2738). */
  ai?: boolean;
  /** Row-menu subtitle noun — "Application update · Mon" (Figma 1:2701). */
  singular: string;
  /** How the row menu's "You keep …" caption names this category (Figma 1:2707). */
  keepName: string;
};

/** NOTIF 04 verbatim (1:2717). Order is the artboard's. */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryMeta[] = [
  {
    key: 'matches',
    label: 'Job matches',
    description: 'One batch a day, never more',
    singular: 'Job match',
    keepName: 'matches',
  },
  {
    key: 'closing',
    label: 'Saved job closing soon',
    description: '48 hours before a saved role closes',
    singular: 'Closing alert',
    keepName: 'closing alerts',
  },
  {
    key: 'applications',
    label: 'Application updates',
    description: 'Viewed, moved stage, decision',
    singular: 'Application update',
    keepName: 'application updates',
  },
  {
    key: 'ai',
    label: 'AI results ready',
    description: 'Scores, cover letters, tailoring',
    ai: true,
    singular: 'AI result',
    keepName: 'AI results',
  },
  {
    key: 'billing',
    label: 'Plan & billing',
    description: 'Renewals, credits, receipts',
    singular: 'Plan & billing',
    keepName: 'billing',
  },
] as const;

export function categoryMeta(category: NotificationCategory): NotificationCategoryMeta {
  const meta = NOTIFICATION_CATEGORIES.find((item) => item.key === category);
  if (!meta) throw new Error(`Unknown notification category "${category}"`);
  return meta;
}

/** NOTIF 04: five category switches plus the two delivery switches. No master toggle — the
 * system permission line at the bottom of the screen plays that role. */
export type NotificationPrefs = {
  categories: Record<NotificationCategory, boolean>;
  /** "10pm – 8am, held until morning" (Figma 1:2754). */
  quietHours: boolean;
  /** "Anything you missed, Sunday 9am" (Figma 1:2760). */
  weeklyDigest: boolean;
};

/** The feed's filter pills (Figma 1:2410): All · Jobs · Applications · Account. */
export type NotificationFilter = 'all' | 'jobs' | 'applications' | 'account';

/**
 * Pill → category mapping. The artboard names only the pills, so the split is ours: "Jobs"
 * covers everything about finding and winning roles (matches, closing alerts, AI results),
 * "Applications" the employer-side updates, "Account" the plan.
 */
export const NOTIFICATION_FILTERS: readonly {
  key: NotificationFilter;
  label: string;
  categories?: readonly NotificationCategory[];
}[] = [
  { key: 'all', label: 'All' },
  { key: 'jobs', label: 'Jobs', categories: ['matches', 'closing', 'ai'] },
  { key: 'applications', label: 'Applications', categories: ['applications'] },
  { key: 'account', label: 'Account', categories: ['billing'] },
] as const;

export function matchesNotificationFilter(
  notification: Notification,
  filter: NotificationFilter,
): boolean {
  if (filter === 'all') return true;
  const entry = NOTIFICATION_FILTERS.find((item) => item.key === filter);
  return entry?.categories?.includes(notification.category) ?? false;
}

/** Feed sections (Figma 1:2419): TODAY · THIS WEEK · EARLIER, by calendar age. */
export type NotificationGroup = 'today' | 'week' | 'earlier';

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  today: 'TODAY',
  week: 'THIS WEEK',
  earlier: 'EARLIER',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function notificationGroup(createdAt: string, now: Date = new Date()): NotificationGroup {
  const then = new Date(createdAt);
  if (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  ) {
    return 'today';
  }
  return now.getTime() - then.getTime() < 7 * DAY_MS ? 'week' : 'earlier';
}
