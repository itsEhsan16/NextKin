import type { Job } from './job';
import { REMOTE_TYPE_LABEL } from './job';
import type { ProfilePreferences } from './profile';
import { REMOTE_PREFERENCE_LABEL } from './profile';
import type { SalaryRange } from './salary';

/**
 * How a job sits with what the candidate asked for (owner, 2026-11-01). Only what a listing states
 * can clash: a job that says nothing about pay or place is `unknown`, and is never hidden. The
 * match score stays about skills; these sit next to it. Sponsorship is left out by the owner's call.
 */

export type FitState = 'fits' | 'clashes' | 'unknown';
export type FitKind = 'location' | 'workplace' | 'salary';
export type FitLabel = { kind: FitKind; state: FitState; text: string };

export type FitJob = Pick<Job, 'location' | 'remote' | 'salary' | 'workplaceUnstated'>;
export type FitPreferences = Pick<ProfilePreferences, 'locations' | 'remote' | 'minSalary'>;

/** The other spelling people use for the same place. */
const SAME_PLACE: readonly (readonly string[])[] = [
  ['bengaluru', 'bangalore'],
  ['mumbai', 'bombay'],
  ['gurugram', 'gurgaon'],
  ['munich', 'münchen'],
  ['cologne', 'köln'],
];

const spellings = (place: string): readonly string[] => {
  const lower = place.trim().toLowerCase();
  return SAME_PLACE.find((names) => names.includes(lower)) ?? [lower];
};

const isInPlace = (location: string, place: string): boolean => {
  const where = location.toLowerCase();
  return spellings(place).some((name) => name.length > 0 && where.includes(name));
};

function workplaceFit(job: FitJob, prefs: FitPreferences): FitLabel | null {
  if (prefs.remote === 'any') return null;
  if (job.workplaceUnstated) {
    return { kind: 'workplace', state: 'unknown', text: 'Workplace not stated' };
  }
  const accepted = { remote: ['remote'], hybrid: ['remote', 'hybrid'], onsite: ['onsite', 'hybrid'] };
  const label = REMOTE_TYPE_LABEL[job.remote];
  return accepted[prefs.remote].includes(job.remote)
    ? { kind: 'workplace', state: 'fits', text: `${label} works for you` }
    : {
        kind: 'workplace',
        state: 'clashes',
        text: `${label}, and you prefer ${REMOTE_PREFERENCE_LABEL[prefs.remote].toLowerCase()}`,
      };
}

function locationFit(job: FitJob, prefs: FitPreferences): FitLabel | null {
  if (prefs.locations.length === 0) return null;
  // A fully remote job isn't anywhere in particular.
  if (job.remote === 'remote' && !job.workplaceUnstated) return null;
  const where = job.location.trim();
  if (!where) return { kind: 'location', state: 'unknown', text: 'Location not stated' };
  return prefs.locations.some((place) => isInPlace(where, place))
    ? { kind: 'location', state: 'fits', text: `In ${where}` }
    : { kind: 'location', state: 'clashes', text: `In ${where}, not one of your places` };
}

const PERIODS_PER_YEAR: Record<SalaryRange['period'], number> = { year: 1, month: 12, hour: 2080 };
const yearly = (amount: number, salary: SalaryRange): number =>
  amount * PERIODS_PER_YEAR[salary.period];

/** Compared only within one currency: a rough rate would turn a guess into a claim about pay. */
function salaryFit(job: FitJob, prefs: FitPreferences): FitLabel | null {
  const wanted = prefs.minSalary;
  const floor = wanted?.min ?? wanted?.max;
  if (!wanted || floor == null) return null;
  const { salary } = job;
  const top = salary?.max ?? salary?.min;
  if (!salary || top == null) return { kind: 'salary', state: 'unknown', text: 'Salary not stated' };
  if (salary.currency !== wanted.currency) {
    return {
      kind: 'salary',
      state: 'unknown',
      text: `Paid in ${salary.currency}, so we can’t compare it`,
    };
  }
  if (yearly(top, salary) >= yearly(floor, wanted)) {
    return { kind: 'salary', state: 'fits', text: 'Meets your minimum salary' };
  }
  // An estimate is the provider's guess, so it can't rule a job out.
  return salary.estimated
    ? { kind: 'salary', state: 'unknown', text: 'Estimated below your minimum salary' }
    : { kind: 'salary', state: 'clashes', text: 'Below your minimum salary' };
}

export function jobFit(job: FitJob, prefs: FitPreferences): FitLabel[] {
  return [workplaceFit(job, prefs), locationFit(job, prefs), salaryFit(job, prefs)].filter(
    (label): label is FitLabel => label !== null,
  );
}

export const jobClashes = (job: FitJob, prefs: FitPreferences): string[] =>
  jobFit(job, prefs)
    .filter((label) => label.state === 'clashes')
    .map((label) => label.text);

/** What picks left out, and why. Search leaves nothing out: only recommendations do this. */
export type HiddenPicks = { count: number; reasons: string[] };

export const NOTHING_HIDDEN: HiddenPicks = { count: 0, reasons: [] };

const MAX_REASONS = 2;

/** The best `limit` jobs that fit, and whatever was passed over on the way to them. */
export function splitPicks<T extends FitJob>(
  ranked: readonly T[],
  prefs: FitPreferences,
  limit: number,
): { kept: T[]; hidden: HiddenPicks } {
  const kept: T[] = [];
  const reasons = new Set<string>();
  let count = 0;
  for (const job of ranked) {
    if (kept.length === limit) break;
    const [clash] = jobClashes(job, prefs);
    if (clash === undefined) {
      kept.push(job);
      continue;
    }
    count++;
    reasons.add(clash);
  }
  return { kept, hidden: { count, reasons: [...reasons].slice(0, MAX_REASONS) } };
}

/** "2 hidden: Hybrid, and you prefer remote · Below your minimum salary". */
export const hiddenPicksLine = (hidden: HiddenPicks): string =>
  `${hidden.count} hidden: ${hidden.reasons.join(' · ')}`;
