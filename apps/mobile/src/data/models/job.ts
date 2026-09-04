import type { SalaryRange } from '@/lib';

/** NextKin V2 spec §10 — Job aggregate (candidate app). */

export type RemoteType = 'remote' | 'hybrid' | 'onsite';

/** "Workplace" pills (Figma 1:790) and the meta line on every job card. */
export const REMOTE_TYPE_LABEL: Record<RemoteType, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

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

/** Seniority band behind the "Experience level" filter group (Figma 1:805). */
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';

export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  entry: 'Entry',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  /**
   * Company profile shown on JOBS 05 (1:889) — "Financial infrastructure · 8,000+ employees".
   * NOTE: the artboard also puts "51–200 employees" in the meta chip row (1:849) for the same
   * company it later calls "8,000+ employees". One field feeds both, so they cannot disagree.
   */
  companyIndustry: string;
  companySize: string;
  companyWebsite: string;
  location: string;
  remote: RemoteType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
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

/** "Date posted" pills (Figma 1:766). `undefined` is the artboard's selected "Any time". */
export const POSTED_WITHIN_LABEL: Record<PostedWithin, string> = {
  '24h': 'Last 24h',
  '7d': 'Past week',
  '30d': 'Past month',
};

export type JobFilters = {
  query?: string;
  locations: string[];
  remote: RemoteType[];
  employmentTypes: EmploymentType[];
  experienceLevels: ExperienceLevel[];
  /**
   * Salary band in INR, from the "Salary range" slider (Figma 1:797). Listings priced in another
   * currency are converted before comparison, so a ₹ band never silently hides foreign roles.
   */
  salaryMin?: number;
  salaryMax?: number;
  postedWithin?: PostedWithin;
  tags: string[];
};

export const EMPTY_JOB_FILTERS: JobFilters = {
  locations: [],
  remote: [],
  employmentTypes: [],
  experienceLevels: [],
  tags: [],
};

/** Ends of the salary slider's scale, in INR (Figma 1:803 "₹0" / 1:804 "₹80L+"). */
export const SALARY_FILTER_MIN = 0;
export const SALARY_FILTER_MAX = 8_000_000;
/** One lakh per notch, so the thumbs land on the values the labels can render. */
export const SALARY_FILTER_STEP = 100_000;

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
