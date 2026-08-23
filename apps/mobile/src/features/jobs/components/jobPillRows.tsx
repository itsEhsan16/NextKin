import type { ReactNode } from 'react';

import {
  EMPLOYMENT_TYPE_LABEL,
  MATCH_BAND_LABEL,
  type Application,
  type Job,
} from '@/data/models';
import { formatDaysAgo, formatRelativeTime } from '@/lib';

import {
  AppliedAgePill,
  ApplicationStatusPill,
  ClosingPill,
  MatchPill,
  MetaPill,
  applicationStatusLabel,
} from './JobPills';

const DAY = 24 * 60 * 60 * 1000;
/** Figma 1:428 shows the urgency pill at 3 days out. */
const CLOSING_SOON_DAYS = 7;

/** Days until the posting closes, but only while that is near enough to warrant the urgency pill. */
function closingIn(job: Job, now: Date): number | undefined {
  if (!job.closingAt) return undefined;
  const days = Math.ceil((new Date(job.closingAt).getTime() - now.getTime()) / DAY);
  return days > 0 && days <= CLOSING_SOON_DAYS ? days : undefined;
}

/** Discover (Figma 1:336): match · employment type · posted age. */
export function discoverPills(job: Job): ReactNode {
  return (
    <>
      {job.matchBand ? <MatchPill band={job.matchBand} /> : null}
      <MetaPill label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} />
      <MetaPill label={formatRelativeTime(job.postedAt)} />
    </>
  );
}

/**
 * Saved (Figma 1:424): match · employment type · saved age — except when the posting is closing
 * soon, where the artboard swaps the age pill for an urgency pill ("Closing in 3d").
 */
export function savedPills(job: Job, now: Date = new Date()): ReactNode {
  const closingInDays = closingIn(job, now);

  return (
    <>
      {job.matchBand ? <MatchPill band={job.matchBand} /> : null}
      <MetaPill label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} />
      {closingInDays != null ? (
        <ClosingPill label={`Closing in ${closingInDays}d`} />
      ) : job.savedAt ? (
        <MetaPill label={`Saved ${formatRelativeTime(job.savedAt)}`} />
      ) : null}
    </>
  );
}

/** Applied (Figma 1:540): the dotted status pill and a bordered "Applied Nd ago". */
export function appliedPills(application: Application): ReactNode {
  return (
    <>
      <ApplicationStatusPill application={application} />
      <AppliedAgePill appliedAt={application.appliedAt} />
    </>
  );
}

/*
 * A card is a single focusable element, so the pills inside it are never announced on their own.
 * These build the same information as a string for the card's accessibility label.
 */

export function discoverPillsLabel(job: Job): string {
  return [
    job.matchBand ? MATCH_BAND_LABEL[job.matchBand] : undefined,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    `posted ${formatRelativeTime(job.postedAt)}`,
  ]
    .filter(Boolean)
    .join(', ');
}

export function savedPillsLabel(job: Job, now: Date = new Date()): string {
  const closingInDays = closingIn(job, now);
  return [
    job.matchBand ? MATCH_BAND_LABEL[job.matchBand] : undefined,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    closingInDays != null
      ? `closing in ${closingInDays} days`
      : job.savedAt
        ? `saved ${formatRelativeTime(job.savedAt)}`
        : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}

export function appliedPillsLabel(application: Application): string {
  return `${applicationStatusLabel(application)}, applied ${formatDaysAgo(application.appliedAt)}`;
}
