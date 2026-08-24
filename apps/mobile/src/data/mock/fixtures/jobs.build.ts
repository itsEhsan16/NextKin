import type {
  EmploymentType,
  ExperienceLevel,
  Job,
  JobSource,
  MatchCriterion,
  MatchCriterionState,
  RemoteType,
} from '@/data/models';
import { matchBandFor } from '@/data/models';
import type { SalaryRange } from '@/lib';

import { daysAgo, daysFromNow } from './time';

/** Compact seed row; `buildJob` expands it into a full Job with placeholder copy. */
export type JobSeed = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  location: string;
  remote: RemoteType;
  employmentType?: EmploymentType;
  /** Defaults to whatever `levelFromTitle` reads off the job title. */
  experienceLevel?: ExperienceLevel;
  applicantsCount?: number;
  salary?: SalaryRange;
  /** Fractional days are fine ("0.5" → 12 hours ago). */
  postedDaysAgo: number;
  source: JobSource;
  tags: string[];
  isPick?: boolean;
  isTodaysPick?: boolean;
  isSaved?: boolean;
  savedDaysAgo?: number;
  /** Days until the posting closes; drives the Saved tab urgency pill. */
  closingInDays?: number;
  /** Only the first page of jobs is matched; `states` is one char per criterion (m/x/o). */
  match?: { score: number; states: string };
  /** Verbatim artboard copy for the jobs a detail screen actually renders (JOBS 05). */
  description?: string;
  responsibilities?: string[];
  /** Criterion labels for "Why you match"; pairs positionally with `match.states`. */
  criteria?: string[];
};

const STATE_BY_CHAR: Record<string, MatchCriterionState> = {
  m: 'met',
  x: 'missing',
  o: 'optional',
};

const remoteCopy: Record<RemoteType, string> = {
  remote: 'fully remote',
  hybrid: 'hybrid (2–3 days in office)',
  onsite: 'on-site',
};

/** Company profiles for JOBS 05's card. Only the companies an artboard names are hand-written. */
type CompanyProfile = { industry: string; size: string };

const COMPANY_PROFILES: Record<string, CompanyProfile> = {
  // Figma 1:893, verbatim.
  Stripe: { industry: 'Financial infrastructure', size: '8,000+ employees' },
  Linear: { industry: 'Developer tools', size: '51–200 employees' },
  Razorpay: { industry: 'Payments', size: '3,000+ employees' },
  Zoho: { industry: 'Business software', size: '15,000+ employees' },
  Freshworks: { industry: 'Customer software', size: '5,000+ employees' },
  Atlassian: { industry: 'Team collaboration', size: '10,000+ employees' },
  Postman: { industry: 'API platform', size: '500–1,000 employees' },
  CRED: { industry: 'Consumer fintech', size: '1,000+ employees' },
};

const DEFAULT_PROFILE: CompanyProfile = { industry: 'Technology', size: '1,000+ employees' };

/** "Delivery Hero" → "deliveryhero.com". Good enough for a mock; the API will return the real one. */
const websiteFor = (company: string): string =>
  `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

/**
 * Seniority read off the title, the way a provider would infer it — so the "Experience level"
 * filter works without hand-labelling all 34 seeds. Order matters: "Senior Design Systems Lead"
 * is a lead role, not a senior one. Seeds can override for anything the title doesn't say.
 */
export function levelFromTitle(title: string): ExperienceLevel {
  const value = title.toLowerCase();
  if (/\b(lead|head|principal|staff|manager|director)\b/.test(value)) return 'lead';
  if (/\b(senior|sr\.?)\b/.test(value)) return 'senior';
  if (/\b(junior|jr\.?|intern|graduate|associate|entry)\b/.test(value)) return 'entry';
  return 'mid';
}

function buildCriteria(seed: JobSeed, states: string): MatchCriterion[] {
  const labels = (
    seed.criteria ?? [
      '5+ years of product design experience',
      ...seed.tags.slice(0, 3).map((tag) => `Hands-on ${tag}`),
      'Portfolio with shipped mobile work',
    ]
  ).slice(0, 5);
  return labels.map((label, index) => ({
    id: `${seed.id}_crit_${index + 1}`,
    label,
    state: STATE_BY_CHAR[states.charAt(index)] ?? 'optional',
  }));
}

export function buildJob(seed: JobSeed, index = 0): Job {
  const {
    match,
    postedDaysAgo,
    savedDaysAgo,
    closingInDays,
    isPick = false,
    isTodaysPick = false,
    isSaved = false,
    employmentType = 'full_time',
    experienceLevel = levelFromTitle(seed.title),
    // Pulled out of `rest` so the generated fallbacks below don't overwrite artboard copy.
    description,
    responsibilities,
    criteria: _criteria,
    ...rest
  } = seed;
  const [primaryTag = 'product design', secondaryTag = 'cross-functional collaboration'] =
    seed.tags;
  const profile = COMPANY_PROFILES[seed.company] ?? DEFAULT_PROFILE;
  return {
    ...rest,
    employmentType,
    experienceLevel,
    companyIndustry: profile.industry,
    companySize: profile.size,
    companyWebsite: websiteFor(seed.company),
    postedAt: daysAgo(postedDaysAgo),
    description:
      description ??
      `${seed.company} is hiring a ${seed.title} to join a ${remoteCopy[seed.remote]} team in ` +
        `${seed.location}. You will own end-to-end design for core product surfaces, partnering ` +
        `closely with engineering and research to ship polished, accessible experiences.`,
    responsibilities: responsibilities ?? [
      `Lead ${primaryTag} work from discovery through launch`,
      'Partner with product and engineering on roadmap and scope',
      `Contribute to and evolve our shared ${secondaryTag} practice`,
      'Run usability sessions and turn findings into iterations',
    ],
    requirements: [
      '5+ years designing consumer or B2B software',
      `Deep fluency in ${primaryTag}`,
      'Strong portfolio demonstrating shipped, measurable outcomes',
      'Comfortable writing clear product narratives and specs',
    ],
    isPick,
    isTodaysPick,
    isSaved,
    // Seed order IS the relevance order the provider would return.
    relevanceRank: index,
    ...(savedDaysAgo != null ? { savedAt: daysAgo(savedDaysAgo) } : {}),
    ...(closingInDays != null ? { closingAt: daysFromNow(closingInDays) } : {}),
    ...(match
      ? {
          matchScore: match.score,
          matchBand: matchBandFor(match.score),
          matchCriteria: buildCriteria(seed, match.states),
        }
      : {}),
  };
}
