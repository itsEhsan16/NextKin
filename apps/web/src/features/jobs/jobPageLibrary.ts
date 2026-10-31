import { applyPageOf } from '@nextkin/shared/jobs/applyPage';
import type { Job, Profile } from '@nextkin/shared/models';
import type { JobFactsKnown } from '@nextkin/shared/queries';
import type { Route } from 'next';

/** The job's own page (724:2). */
export function jobPageHref(id: string): Route {
  return `/jobs/${encodeURIComponent(id)}` as Route;
}

/** The tailor flow for one job (734:2). */
export function tailorHref(id: string): Route {
  return `/jobs/${encodeURIComponent(id)}/tailor` as Route;
}

const norm = (value: string) => value.trim().toLowerCase();

/** Whether the profile lists a skill, matched on its words rather than its spelling. */
export const hasSkill = (profile: Profile | undefined, skill: string): boolean =>
  Boolean(profile?.skills.some((own) => norm(own) === norm(skill)));

export type MatchRow = { label: string; value: string; met: boolean };

/**
 * The match card's four lines (724:2, "Experience level · Meets"), read off the profile against
 * the listing — so each says something true about this user, not a copy of the board's. For a job
 * description (`known`), a line the JD gives nothing for is left out rather than called a match.
 */
export function matchRows(
  job: Job,
  profile: Profile | undefined,
  known?: JobFactsKnown,
): MatchRow[] {
  const rows = listingMatchRows(job, profile);
  if (!known) return rows;
  return rows.filter(
    (row) =>
      (row.label !== 'Experience level' || known.years) &&
      (row.label !== 'Location' || known.location || known.remote) &&
      (row.label !== 'Work type' || known.remote),
  );
}

function listingMatchRows(job: Job, profile: Profile | undefined): MatchRow[] {
  // The server's count when there is one (the same ledger behind the number); else the tags.
  const basis = job.matchBasis;
  const skills = job.tags;
  const have = basis
    ? basis.requiredMet + basis.requiredPartial
    : skills.filter((skill) => hasSkill(profile, skill)).length;
  const total = basis ? basis.requiredTotal : skills.length;
  const years = profile?.yearsExperience;
  const range = job.experienceYears;
  const experienceMet = years == null || range == null ? true : years >= range.min;
  const places = profile?.preferences.locations ?? [];
  const locationMet =
    job.remote === 'remote' ||
    places.length === 0 ||
    places.some((place) => norm(job.location).includes(norm(place).split(',')[0] ?? ''));
  const wanted = profile?.preferences.remote;
  const workMet =
    !wanted ||
    wanted === 'any' ||
    wanted === job.remote ||
    (wanted === 'hybrid' && job.remote !== 'remote');
  return [
    { label: 'Experience level', value: experienceMet ? 'Meets' : 'Below', met: experienceMet },
    { label: 'Skills', value: `${have} of ${total}`, met: have === total },
    { label: 'Location', value: locationMet ? 'Matches' : 'Differs', met: locationMet },
    { label: 'Work type', value: workMet ? 'Matches' : 'Differs', met: workMet },
  ];
}

/** "Mountain View, CA" beside the company name: the headquarters' city and state, shortened. */
export function shortPlace(place: string | undefined): string | undefined {
  if (!place) return undefined;
  const [city, region] = place.split(',').map((part) => part.trim());
  const STATES: Record<string, string> = { California: 'CA', Washington: 'WA', 'New York': 'NY' };
  return region ? `${city}, ${STATES[region] ?? region}` : city;
}

/** The employer's site as written on the page: "google.com", whatever the stored form. */
export const siteLabel = (url: string): string =>
  url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Where "Apply on company site" goes: the employer's application page, else its site. */
export const applyUrl = (job: Job): string => applyPageOf(job) ?? '';
