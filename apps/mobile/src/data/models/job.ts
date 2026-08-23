import type { SalaryRange } from '@/lib';

/** NextKin V2 spec §10 — Job aggregate (candidate app). */

export type RemoteType = 'remote' | 'hybrid' | 'onsite';

export type JobSource = 'adzuna' | 'jsearch' | 'manual';

export type MatchBand = 'strong' | 'good' | 'fair';

/** Pill copy on the job cards (Figma 1:338 / 1:352). */
export const MATCH_BAND_LABEL: Record<MatchBand, string> = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
};

export type MatchCriterionState = 'met' | 'missing' | 'optional';

export type MatchCriterion = {
  id: string;
  label: string;
  state: MatchCriterionState;
};

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance';

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  location: string;
  remote: RemoteType;
  employmentType: EmploymentType;
  /** Provider-reported applicant count, when known ("80+ applied"). */
  applicantsCount?: number;
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
  /** ISO-8601; set when isSaved flips on. */
  savedAt?: string;
  /** Editorial flag for Home's match-ranked "Top Job Matches". */
  isPick: boolean;
  /** Editorial flag for the Jobs tab's freshness-ranked "Today's picks" carousel. */
  isTodaysPick: boolean;
  /** Provider relevance rank (lower first) — the default "Relevance" sort order. */
  relevanceRank: number;
  /** ISO-8601 application deadline; drives the "Closing in 3d" urgency pill on Saved. */
  closingAt?: string;
};

/** Sort options behind the "Relevance" control (Figma 1:326). */
export type JobSort = 'relevance' | 'recent' | 'salary';

export const JOB_SORT_LABEL: Record<JobSort, string> = {
  relevance: 'Relevance',
  recent: 'Most recent',
  salary: 'Salary',
};

export type PostedWithin = '24h' | '7d' | '30d';

export type JobFilters = {
  query?: string;
  locations: string[];
  remote: RemoteType[];
  employmentTypes: EmploymentType[];
  /** Compared against the listing's upper salary bound in the listing's own currency. */
  salaryMin?: number;
  postedWithin?: PostedWithin;
  tags: string[];
};

export const EMPTY_JOB_FILTERS: JobFilters = {
  locations: [],
  remote: [],
  employmentTypes: [],
  tags: [],
};

/** Band thresholds shared by fixtures and match meters. */
export function matchBandFor(score: number): MatchBand {
  if (score >= 0.8) return 'strong';
  if (score >= 0.6) return 'good';
  return 'fair';
}

/**
 * Application states as the Applied artboard words them (JOBS 03). Note the design says
 * "Not selected" rather than "rejected", and distinguishes a plain submission from one the
 * employer has opened ("Applied · Viewed").
 */
export type ApplicationStatus =
  | 'applied'
  | 'viewed'
  | 'in_review'
  | 'interview'
  | 'offer'
  | 'not_selected'
  | 'withdrawn';

export type ApplicationTone = 'neutral' | 'success' | 'warning' | 'danger';

export const APPLICATION_TONE: Record<ApplicationStatus, ApplicationTone> = {
  applied: 'neutral',
  viewed: 'neutral',
  in_review: 'warning',
  interview: 'success',
  offer: 'success',
  not_selected: 'danger',
  withdrawn: 'neutral',
};

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
  /** ISO-8601; set when status is 'interview' so the pill can name the day. */
  interviewAt?: string;
  resumeId?: string;
};

/** An application together with the listing it targets — what the Applied tab renders. */
export type ApplicationWithJob = { application: Application; job: Job };
