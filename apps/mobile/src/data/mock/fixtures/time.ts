/** Fixture timestamps are relative to module load so "posted 2d ago" never goes stale. */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = Date.now();

export const nowIso = (): string => new Date(NOW).toISOString();

export const minutesAgo = (n: number): string => new Date(NOW - n * MINUTE).toISOString();

export const hoursAgo = (n: number): string => new Date(NOW - n * HOUR).toISOString();

export const daysAgo = (n: number): string => new Date(NOW - n * DAY).toISOString();

export const daysFromNow = (n: number): string => new Date(NOW + n * DAY).toISOString();
