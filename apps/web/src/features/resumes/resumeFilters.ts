import type { Resume, ResumeVariant } from '@nextkin/shared/models';

import { isWithin, type TimeWindow } from '@/lib/timeWindow';

import { stateOf, type ResumeState } from './resumeLibrary';

/** The four chips over the list (304:3108). None is drawn open, so what each offers is ours. */
export type ResumeFilters = {
  variants: ResumeVariant[];
  updatedWithin?: TimeWindow;
  roles: string[];
  states: ResumeState[];
};

export const EMPTY_RESUME_FILTERS: ResumeFilters = { variants: [], roles: [], states: [] };

/**
 * Filtered here rather than in the repo: the whole library arrives in one call, as it does on
 * mobile, so there is no page of results to narrow on the server.
 */
export function matchesResumeFilters(
  resume: Resume,
  filters: ResumeFilters,
  now = Date.now(),
): boolean {
  if (filters.variants.length > 0 && !(resume.variant && filters.variants.includes(resume.variant)))
    return false;
  if (filters.updatedWithin && !isWithin(resume.updatedAt, filters.updatedWithin, now))
    return false;
  if (filters.roles.length > 0 && !(resume.targetRole && filters.roles.includes(resume.targetRole)))
    return false;
  if (filters.states.length > 0) {
    const state = stateOf(resume);
    if (!state || !filters.states.includes(state)) return false;
  }
  return true;
}

/**
 * "Search resumes..." (304:3248): free text over each document's title and what it is for, the
 * search V2 §7.11 asks of the library ("across titles and companies").
 */
export function matchesResumeSearch(resume: Resume, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [resume.title, resume.description, resume.targetRole, resume.targetCompany].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}
