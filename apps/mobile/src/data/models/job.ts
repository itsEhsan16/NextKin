import type { SalaryRange } from '@/lib';

/** NextKin V2 spec §10 — Job aggregate (candidate app). */

export type RemoteType = 'remote' | 'hybrid' | 'onsite';

export type JobSource = 'adzuna' | 'jsearch' | 'manual';

export type MatchBand = 'strong' | 'good' | 'fair';

export type MatchCriterionState = 'met' | 'missing' | 'optional';

export type MatchCriterion = {
  id: string;
  label: string;
  state: MatchCriterionState;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  location: string;
  remote: RemoteType;
  salary?: SalaryRange;
  /** ISO-8601 */
  postedAt: string;
  source: JobSource;
  /** 0–1; absent until the profile has been matched against the job. */
  matchScore?: number;
  matchBand?: MatchBand;
  matchCriteria?: MatchCriterion[];
  description: string;
  responsibilities: string[];
  requirements: string[];
  tags: string[];
  isSaved: boolean;
  /** Editorial "Picks for you" flag. */
  isPick: boolean;
};

export type PostedWithin = '24h' | '7d' | '30d';

export type JobFilters = {
  query?: string;
  locations: string[];
  remote: RemoteType[];
  /** Compared against the listing's upper salary bound in the listing's own currency. */
  salaryMin?: number;
  postedWithin?: PostedWithin;
  tags: string[];
};

export const EMPTY_JOB_FILTERS: JobFilters = { locations: [], remote: [], tags: [] };

/** Band thresholds shared by fixtures and match meters. */
export function matchBandFor(score: number): MatchBand {
  if (score >= 0.8) return 'strong';
  if (score >= 0.6) return 'good';
  return 'fair';
}

export type ApplicationStatus = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';

/**
 * RELEASE 2 — application tracking ships after MVP (V2 spec §6.2).
 * Modelled now so the jobs repo and "Applied" tab can be wired without a schema change.
 */
export type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  /** ISO-8601 */
  appliedAt: string;
  resumeId?: string;
};
