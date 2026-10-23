/** NextKin V2 spec §10 — Notifications aggregate, reshaped to NOTIF 01–07. */

/** The five push categories NOTIF 04 offers — "Five categories, deliberately." */
export type NotificationCategory =
  "matches" | "closing" | "applications" | "ai" | "billing";

/** Leading tile on a feed card (NOTIF 01 redesign, Figma 619:43 / 619:55 / 619:65 / 619:78). */
export type NotificationVisual =
  /** Brand sparkle tile — the daily matches digest. */
  | { kind: "sparkle" }
  /** Company monogram tile; the client decides the company's tint. */
  | { kind: "logo"; company: string }
  /**
   * FA5 glyph tile in one of the board's tints. `regular` picks the outlined FA5 face, which the
   * board draws for the clock and the card (619:77 / 619:130).
   */
  | {
      kind: "glyph";
      icon: string;
      tone: "brand" | "success" | "warning" | "info" | "neutral";
      regular?: boolean;
    };

export type Notification = {
  id: string;
  category: NotificationCategory;
  /**
   * The card's headline (Figma 619:46 / 619:81). A plain line is set bold throughout; a line
   * with `**bold**` runs is set medium with those runs bold ("**Razorpay** — Senior UX Designer
   * **closes in 3 days**"). Parse with `parseBold` from @/lib.
   */
  body: string;
  /** The grey line under the headline (Figma 619:47). */
  description: string;
  /** ISO-8601 */
  createdAt: string;
  read: boolean;
  /**
   * In-app destination (expo-router href). Canvas note 1:2497: every row deep-links to its
   * exact destination — job detail, score panel, plan screen — never a tab root.
   */
  deepLink?: string;
  visual: NotificationVisual;
  /** Matches-digest extras: a row of company tiles + overflow (Figma 619:23). */
  stack?: { companies: string[]; more?: number };
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
    key: "matches",
    label: "Job matches",
    description: "One batch a day, never more",
    singular: "Job match",
    keepName: "matches",
  },
  {
    key: "closing",
    label: "Saved job closing soon",
    description: "48 hours before a saved role closes",
    singular: "Closing alert",
    keepName: "closing alerts",
  },
  {
    key: "applications",
    label: "Application updates",
    description: "Viewed, moved stage, decision",
    singular: "Application update",
    keepName: "application updates",
  },
  {
    key: "ai",
    label: "AI results ready",
    description: "Scores, cover letters, tailoring",
    ai: true,
    singular: "AI result",
    keepName: "AI results",
  },
  {
    key: "billing",
    label: "Plan & billing",
    description: "Renewals, credits, receipts",
    singular: "Plan & billing",
    keepName: "billing",
  },
] as const;

export function categoryMeta(
  category: NotificationCategory,
): NotificationCategoryMeta {
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

/**
 * How a notification reaches the candidate on the web Settings → Notifications board
 * (Figma 247:1303): in the app, by email, or pushed to a device.
 */
export type NotificationChannel = "inApp" | "email" | "push";

/**
 * What a notification is about on the same board (247:1338): seven topics, where mobile's NOTIF 04
 * draws five categories. The two boards disagree, and each app keeps its own (`toreview.md` §24).
 */
export type NotificationTopic =
  | "jobMatches"
  | "applicationUpdates"
  | "interviewReminders"
  | "resumeInsights"
  | "productUpdates"
  | "tips"
  | "accountSecurity";

/** Each channel as a whole, then each topic on each channel (247:1303-1498). */
export type NotificationSettings = {
  channels: Record<NotificationChannel, boolean>;
  topics: Record<NotificationTopic, Record<NotificationChannel, boolean>>;
};

/**
 * What a new account starts with, and what "Reset to default" returns to. The boards define them
 * (NOTIF 04, Figma 1:2748; web Settings → Notifications, 247:1303-1498), so the mock fixtures and
 * the server read these same values.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  categories: { matches: true, closing: true, applications: true, ai: true, billing: false },
  quietHours: true,
  weeklyDigest: true,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: { inApp: true, email: true, push: true },
  topics: {
    jobMatches: { inApp: true, email: true, push: true },
    applicationUpdates: { inApp: true, email: true, push: true },
    interviewReminders: { inApp: true, email: true, push: true },
    resumeInsights: { inApp: true, email: true, push: false },
    productUpdates: { inApp: true, email: false, push: false },
    tips: { inApp: true, email: true, push: false },
    accountSecurity: { inApp: true, email: true, push: true },
  },
};

/** The feed's filter pills (Figma 1:2410): All · Jobs · Applications · Account. */
export type NotificationFilter = "all" | "jobs" | "applications" | "account";

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
  { key: "all", label: "All" },
  { key: "jobs", label: "Jobs", categories: ["matches", "closing", "ai"] },
  { key: "applications", label: "Applications", categories: ["applications"] },
  { key: "account", label: "Account", categories: ["billing"] },
] as const;

export function matchesNotificationFilter(
  notification: Notification,
  filter: NotificationFilter,
): boolean {
  if (filter === "all") return true;
  const entry = NOTIFICATION_FILTERS.find((item) => item.key === filter);
  return entry?.categories?.includes(notification.category) ?? false;
}

/** Feed sections (Figma 1:2419): TODAY · THIS WEEK · EARLIER, by calendar age. */
export type NotificationGroup = "today" | "week" | "earlier";

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  today: "TODAY",
  week: "THIS WEEK",
  earlier: "EARLIER",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The feed's items in TODAY / THIS WEEK / EARLIER order, ready for a list with sticky headers:
 * each group that has anything in it contributes a header item followed by its rows, and
 * `stickyIndices` names the header positions. Generic over the row, because the notifications
 * feed and the History feed bucket different things by the same rule — the second copy of this
 * loop was the one that would have drifted.
 */
export type AgedFeedItem<T> =
  { type: "header"; group: NotificationGroup } | { type: "row"; row: T };

export function groupByAge<T>(
  rows: readonly T[],
  createdAtOf: (row: T) => string,
  now: Date = new Date(),
): { items: AgedFeedItem<T>[]; stickyIndices: number[] } {
  const byGroup = new Map<NotificationGroup, T[]>();
  for (const row of rows) {
    const group = notificationGroup(createdAtOf(row), now);
    byGroup.set(group, [...(byGroup.get(group) ?? []), row]);
  }
  const items: AgedFeedItem<T>[] = [];
  const stickyIndices: number[] = [];
  for (const group of ["today", "week", "earlier"] as const) {
    const bucket = byGroup.get(group);
    if (!bucket?.length) continue;
    stickyIndices.push(items.length);
    items.push({ type: "header", group });
    bucket.forEach((row) => items.push({ type: "row", row }));
  }
  return { items, stickyIndices };
}

export function notificationGroup(
  createdAt: string,
  now: Date = new Date(),
): NotificationGroup {
  const then = new Date(createdAt);
  if (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  ) {
    return "today";
  }
  return now.getTime() - then.getTime() < 7 * DAY_MS ? "week" : "earlier";
}
