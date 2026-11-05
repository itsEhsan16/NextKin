import type { AdminRole } from '@nextkin/shared/models';

/**
 * How the People boards write dates and ids. The boards differ a little from one another, and
 * each is followed: Users zero-pads the day ("Oct 02, 2026"), Deletion requests doesn't
 * ("Oct 9, 2026").
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Mar 14, 2026", or "Oct 02, 2026" with `pad`. */
export function formatDate(iso: string, pad = false): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: pad ? '2-digit' : 'numeric',
    year: 'numeric',
  });
}

/** "Nov 3" — or "Nov 03" with `pad`. */
export function formatShortDate(iso: string, pad = false): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: pad ? '2-digit' : 'numeric',
  });
}

/** "Nov 3, 18:01". */
export function formatDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatShortDate(iso)}, ${time}`;
}

/**
 * How long ago, as the boards write it: "Just now", "2 min ago", "1 h ago", "Yesterday", then
 * either "6 days ago" (Users, `days`) or the date "Nov 2" (Staff & roles, `date`).
 */
export function formatAgo(iso: string, after: 'days' | 'date', now = Date.now()): string {
  const gone = now - Date.parse(iso);
  if (gone < MINUTE) return 'Just now';
  if (gone < HOUR) return `${Math.floor(gone / MINUTE)} min ago`;
  if (gone < DAY) return `${Math.floor(gone / HOUR)} h ago`;
  if (gone < 2 * DAY) return 'Yesterday';
  if (after === 'days' && gone < 30 * DAY) return `${Math.floor(gone / DAY)} days ago`;
  return formatShortDate(iso);
}

/** Whole days from now until a moment, rounded up: "3 days" left. */
export const daysUntil = (iso: string, now = Date.now()) =>
  Math.ceil((Date.parse(iso) - now) / DAY);

/**
 * Where a due date stands: overdue by whole days (at least one) once it has passed, else the days
 * left, rounded up (0 is due today).
 */
export function dueState(iso: string, now = Date.now()): { overdue: boolean; days: number } {
  const gap = Date.parse(iso) - now;
  return gap < 0
    ? { overdue: true, days: Math.max(1, Math.floor(-gap / DAY)) }
    : { overdue: false, days: Math.ceil(gap / DAY) };
}

/** "Today, 09:14" for an event today, else "Nov 3, 18:01" (the security events table). */
export function formatEventTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const today = at.toDateString() === now.toDateString();
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return today ? `Today, ${time}` : `${formatShortDate(iso)}, ${time}`;
}

/** A user id shortened for a page about that user: "7f3c…a91e". */
export const shortId = (id: string) => {
  const bare = id.replace(/^[a-z]+_/, '');
  return `${bare.slice(0, 4)}…${bare.slice(-4)}`;
};

/** A user id where the user isn't the page's subject: "user ···4f2a". */
export const maskUser = (id: string) => `user ···${id.slice(-4)}`;

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  curator: 'Curator',
  support: 'Support',
};

/** The avatar tints the boards cycle through (Figma 404:885–404:1100). */
export const AVATAR_TINTS = [
  'bg-brand-100 text-brand-700',
  'bg-info-50 text-info-600',
  'bg-warning-50 text-warning-600',
  'bg-success-50 text-success-600',
  'bg-neutral-100 text-neutral-600',
] as const;
