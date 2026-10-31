import type { SalaryRange } from '../models';

/** NextKin V2 spec §10 — Job aggregate (candidate app). */

export type RemoteType = 'remote' | 'hybrid' | 'onsite';

/** "Workplace" pills (Figma 1:790) and the meta line on every job card. */
export const REMOTE_TYPE_LABEL: Record<RemoteType, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

/** Where a listing came from. `fixture` is the local synthetic catalogue (refused in production). */
export type JobSource = 'adzuna' | 'jsearch' | 'manual' | 'fixture';

/** `weak` joined with C-10: a match under 40% says little, and the card says so. */
export type MatchBand = 'strong' | 'good' | 'fair' | 'weak';

/** Pill copy on the job cards (Figma 1:338 / 1:352). */
export const MATCH_BAND_LABEL: Record<MatchBand, string> = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
  weak: 'Weak match',
};

/**
 * `partial` is D-14's half credit: a skill the profile lists but no dated role shows. Until a design
 * draws it, both apps group it with `met` and say so in the row's detail.
 */
export type MatchCriterionState = 'met' | 'partial' | 'missing' | 'optional';

/**
 * What a match number rests on (P11-03, G16: every number shows its basis). `kind` is how much of
 * the listing there was to read: the full description, a provider's snippet, or the title alone.
 */
export type MatchBasis = {
  kind: 'full' | 'snippet' | 'title';
  requiredMet: number;
  requiredPartial: number;
  requiredTotal: number;
  preferredMet: number;
  preferredTotal: number;
  /** The versioned method that produced it, e.g. `jobmatch-1`. */
  method: string;
};

/**
 * The one-line caption beside a match number or band (toreview §105.18: spec-derived until an
 * artboard draws it). "From a short listing · 3 of 5 required".
 */
export function matchBasisCaption(basis: MatchBasis): string {
  const source =
    basis.kind === 'full'
      ? 'From the full listing'
      : basis.kind === 'snippet'
        ? 'From a short listing'
        : 'From the job title only';
  if (basis.requiredTotal === 0) return `${source} · no required skills listed`;
  const met = basis.requiredMet + basis.requiredPartial;
  return `${source} · ${met} of ${basis.requiredTotal} required`;
}

/** Who a listing came from, as the provider's terms ask it to be credited (V2 §7.13). */
export type JobAttribution = {
  provider: JobSource;
  /** "Jobs by Adzuna". */
  label: string;
  /** A bundled asset key for the provider's mark, when its terms require one. */
  logoKey?: string;
  /** The brand an estimated salary must carry, when the provider estimates it. */
  salaryBrand?: string;
};

export type MatchCriterion = {
  id: string;
  label: string;
  state: MatchCriterionState;
  /** The evidence, e.g. "Required: 5+ years — you have 8". */
  detail?: string;
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
  /** Company blurb for the company screen (plan phase 9H). */
  companyAbout?: string;
  /**
   * Whether the company carries the verified badge on Job Detail (Figma 443:105). Only big,
   * established companies are verified.
   *
   * NOTE: V2 defines no employer-verification process, so this is mock data until a real API
   * says what "verified" means — it is a trust claim.
   */
  companyVerified?: boolean;
  /**
   * One-line description under the company name on Job Detail's company card (Figma 443:65).
   * Verified companies only; an unverified company's card has no description line at all.
   */
  companyTagline?: string;
  location: string;
  remote: RemoteType;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  /**
   * The listing's own required-experience range, when the provider states one — "3–5 years" on
   * the web Jobs board (Figma 304:2479). `experienceLevel` stays the filterable band; this is copy.
   */
  experienceYears?: { min: number; max: number };
  /** The employer's own requisition id, when the listing gives one: "GOO-UX-10234" (Figma 286:1608). */
  reference?: string;
  /** Provider-reported applicant count, when known ("80+ applied"). */
  applicantsCount?: number;
  salary?: SalaryRange;
  /** ISO-8601 */
  postedAt: string;
  source: JobSource;
  /**
   * The posting a job added from a copied link was read from (TAILOR 00c). Such a job is the
   * user's own: it lives in Saved jobs and never shows up in search or anyone's picks.
   */
  sourceUrl?: string;
  /**
   * 0–1; absent until the profile has been matched against the job, and withheld for a listing
   * read from a snippet or a title alone (P11-03): those carry the band and the basis only.
   */
  matchScore?: number;
  /** What the match rests on; present whenever a band is (G16). */
  matchBasis?: MatchBasis;
  matchBand?: MatchBand;
  matchCriteria?: MatchCriterion[];
  /**
   * One line on why this job matches, as the redrawn job cards show it (Figma 498:25).
   * Editorial for now: the match engine scores criteria but writes no prose, so this is absent
   * for every job an artboard does not name and the card simply drops the panel.
   */
  matchReason?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  /**
   * The web job page's extras (724:2), where a listing states them: its benefits in full, the
   * short perks the header tags with, the employer's industries, and when and where it began.
   */
  benefits?: string[];
  perks?: string[];
  industries?: string[];
  companyFounded?: number;
  companyHeadquarters?: string;
  /**
   * Where "Apply on company site" goes: the employer's own application page, or the provider's
   * tracked redirect to it when its terms require one (Adzuna's).
   */
  applyUrl?: string;
  /** How much of the listing there is: its full description, a snippet, or only a title. */
  descriptionKind?: 'full' | 'snippet' | 'title';
  /** The provider credit a listing must carry (V2 §7.13). */
  attribution?: JobAttribution;
  /** A saved listing its source has closed: kept, flagged, never deleted (P11-04). */
  unavailable?: boolean;
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

/** A copied job link as read before it is added (TAILOR 00c): enough to name it. */
export type JobLinkPreview = {
  url: string;
  /** "careers.swiggy.com": the site the link points at. */
  host: string;
  title: string;
  company: string;
};

/** Sort options behind the "Relevance" control (Figma 1:326). */
export type JobSort = 'relevance' | 'recent' | 'salary';

export const JOB_SORT_LABEL: Record<JobSort, string> = {
  relevance: 'Relevance',
  recent: 'Most recent',
  salary: 'Salary',
};

/**
 * Saved jobs sort differently from Discover: `relevanceRank` is the provider's ranking of a search
 * result, and once a job is saved there is no search to be relevant to — so the default becomes the
 * order the user saved them in, and the deadline takes relevance's place.
 */
export type SavedJobsSort = 'recent' | 'closing' | 'salary';

export const SAVED_JOBS_SORT_LABEL: Record<SavedJobsSort, string> = {
  recent: 'Recently saved',
  closing: 'Closing soon',
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
  /** Web's "Company" filter chip (Figma 304:2430) — mobile has no equivalent, but this filters
   * the same underlying `Job.company` field either platform reads. */
  companies: string[];
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
  companies: [],
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
  if (score >= 0.4) return 'fair';
  return 'weak';
}

/**
 * Application states as the Applied artboard words them (JOBS 03). Note the design says
 * "Not selected" rather than "rejected", and distinguishes a plain submission from one the
 * employer has opened ("Applied · Viewed").
 */
export type ApplicationStatus =
  'applied' | 'viewed' | 'in_review' | 'interview' | 'offer' | 'not_selected' | 'withdrawn';

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

/**
 * "Did you apply?" (owner, 2026-10-31). NextKin never submits an application, so the candidate's
 * answer is the only source of the Applied list. `id` is the application it would become.
 */
export type ApplicationAsk = { id: string; jobId: string; title: string; company: string };

export type ApplicationAnswer = 'yes' | 'not_yet' | 'no';

/** What the ask is about: a job, or a resume made for one. A resume with no job asks nothing. */
export type ApplicationTarget = { jobId: string; resumeId?: string } | { resumeId: string };
