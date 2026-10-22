import {
  EMPLOYMENT_TYPE_LABEL,
  MATCH_BAND_LABEL,
  REMOTE_TYPE_LABEL,
  type Application,
  type Job,
} from '@/data/models';
import { formatDaysAgo, formatRelativeTime, formatSalary } from '@/lib';
import type { ColorToken } from '@/theme';

import { applicationStatusLabel } from './JobPills';

const DAY = 24 * 60 * 60 * 1000;
/** Figma 1:428 shows the urgency pill at 3 days out. */
const CLOSING_SOON_DAYS = 7;

/** Days until the posting closes, but only while that is near enough to warrant the urgency. */
function closingIn(job: Job, now: Date): number | undefined {
  if (!job.closingAt) return undefined;
  const days = Math.ceil((new Date(job.closingAt).getTime() - now.getTime()) / DAY);
  return days > 0 && days <= CLOSING_SOON_DAYS ? days : undefined;
}

/**
 * The tag row under the title (Figma 498:14): where, how, what kind, how much.
 *
 * The workplace pill is dropped when the location has already said it — the board gives Linear
 * "Remote (India) · Full-time · ₹32–42L" and no second "Remote", while Postman, whose location is
 * Bengaluru, keeps both.
 */
export function jobTags(job: Job): string[] {
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  const duplicate = job.location.toLowerCase().includes(workplace.toLowerCase());

  return [
    job.location,
    duplicate ? undefined : workplace,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    job.salary ? formatSalary(job.salary) : undefined,
  ].filter((tag): tag is string => Boolean(tag));
}

export type FooterNote = { note: string; noteColor?: ColorToken };

/** Discover (498:32). */
export function discoverNote(job: Job): FooterNote {
  return { note: `Posted ${formatRelativeTime(job.postedAt)}` };
}

/**
 * Saved (521:32 / 521:71): when you saved it — or, once the posting is nearly gone, how long is
 * left, which the board puts in the same slot in amber instead of adding a pill.
 */
export function savedNote(job: Job, now: Date = new Date()): FooterNote {
  const days = closingIn(job, now);
  if (days != null) return { note: `Closing in ${days}d`, noteColor: 'warningStrong' };
  return { note: job.savedAt ? `Saved ${formatRelativeTime(job.savedAt)}` : 'Saved' };
}

/** Applied (521:266). */
export function appliedNote(application: Application): FooterNote {
  return { note: `Applied ${formatDaysAgo(application.appliedAt)}` };
}

/*
 * A card is a single focusable element, so nothing inside it is announced on its own. These build
 * the same information as a string for the card's accessibility label.
 */

export function jobCardLabel(job: Job, note: string, extra?: string): string {
  return [
    job.title,
    job.company,
    ...jobTags(job),
    job.matchBand ? MATCH_BAND_LABEL[job.matchBand] : undefined,
    job.matchReason,
    extra,
    note,
  ]
    .filter(Boolean)
    .join(', ');
}

export function appliedCardLabel(job: Job, application: Application, note: string): string {
  return [job.title, job.company, ...jobTags(job), applicationStatusLabel(application), note]
    .filter(Boolean)
    .join(', ');
}
