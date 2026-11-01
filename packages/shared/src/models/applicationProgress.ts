import type { Application, ApplicationStatus, ApplicationWithJob } from './job';

/**
 * Where a search stands, from what the candidate told us (owner, 2026-11-01). NextKin can't see
 * employers, so a follow-up is a question: 7 days after applying, once more at 21, then it stops.
 * The rule lives here so the server's job and the Home card can't disagree on what is due.
 */

/** Days after applying that a follow-up asks. */
export const FOLLOW_UP_DAYS = [7, 21] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Still waiting on the employer; anything else has an answer. */
export const OPEN_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'applied',
  'viewed',
  'in_review',
];

export const isOpenApplication = (application: Pick<Application, 'status'>): boolean =>
  OPEN_APPLICATION_STATUSES.includes(application.status);

/**
 * True when the latest follow-up point has passed with no word since it. An open application with
 * no answer stays due, however long ago that was: it's still something only they can tell us.
 */
export function followUpDue(
  application: Pick<Application, 'status' | 'appliedAt' | 'checkedAt'>,
  now: Date,
): boolean {
  if (!isOpenApplication(application)) return false;
  const applied = new Date(application.appliedAt).getTime();
  const passed = FOLLOW_UP_DAYS.map((days) => applied + days * DAY_MS).filter(
    (at) => at <= now.getTime(),
  );
  const latest = passed.at(-1);
  if (latest === undefined) return false;
  return !application.checkedAt || new Date(application.checkedAt).getTime() < latest;
}

export type ApplicationProgress = {
  applied: number;
  interviews: number;
  offers: number;
  toCheck: number;
};

export function applicationProgress(rows: ApplicationWithJob[], now: Date): ApplicationProgress {
  return {
    applied: rows.length,
    interviews: rows.filter((row) => row.application.status === 'interview').length,
    offers: rows.filter((row) => row.application.status === 'offer').length,
    toCheck: rows.filter((row) => followUpDue(row.application, now)).length,
  };
}

const counted = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** "5 applied · 1 interview · 2 to check on". A part at zero says nothing, so it's left out. */
export function applicationProgressLine(progress: ApplicationProgress): string {
  return [
    `${progress.applied} applied`,
    progress.interviews ? counted(progress.interviews, 'interview') : undefined,
    progress.offers ? counted(progress.offers, 'offer') : undefined,
    progress.toCheck ? `${progress.toCheck} to check on` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** What a candidate can say about an application. `viewed` is an employer event we can't know. */
export const APPLICATION_STATUS_CHOICES: readonly { status: ApplicationStatus; label: string }[] = [
  { status: 'applied', label: 'No news yet' },
  { status: 'in_review', label: 'Heard back' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
  { status: 'not_selected', label: 'Not selected' },
  { status: 'withdrawn', label: 'Withdrawn' },
];
