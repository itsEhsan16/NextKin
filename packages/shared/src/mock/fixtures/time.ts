/** Fixture timestamps are relative to module load so "posted 2d ago" never goes stale. */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = Date.now();

export const nowIso = (): string => new Date(NOW).toISOString();

export const minutesAgo = (n: number): string => new Date(NOW - n * MINUTE).toISOString();

export const hoursAgo = (n: number): string => new Date(NOW - n * HOUR).toISOString();

export const daysAgo = (n: number): string => new Date(NOW - n * DAY).toISOString();

/**
 * `n` hours ago, but never earlier than the current calendar day.
 *
 * The feed buckets by calendar date (`notificationGroup`), so between midnight and 05:00
 * `hoursAgo(5)` lands on *yesterday* and a fixture that means "this arrived today" quietly moves
 * to THIS WEEK — taking the TODAY header with it. Clamping to just after midnight keeps the
 * fixture saying what it means at whatever hour the suite happens to run.
 */
export const earlierToday = (n: number): string => {
  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  return new Date(Math.max(NOW - n * HOUR, midnight.getTime() + MINUTE)).toISOString();
};

export const daysFromNow = (n: number): string => new Date(NOW + n * DAY).toISOString();
