import type {
  EmploymentType,
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

function buildCriteria(seed: JobSeed, states: string): MatchCriterion[] {
  const labels = [
    '5+ years of product design experience',
    ...seed.tags.slice(0, 3).map((tag) => `Hands-on ${tag}`),
    'Portfolio with shipped mobile work',
  ].slice(0, 5);
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
    ...rest
  } = seed;
  const [primaryTag = 'product design', secondaryTag = 'cross-functional collaboration'] =
    seed.tags;
  return {
    ...rest,
    employmentType,
    postedAt: daysAgo(postedDaysAgo),
    description:
      `${seed.company} is hiring a ${seed.title} to join a ${remoteCopy[seed.remote]} team in ` +
      `${seed.location}. You will own end-to-end design for core product surfaces, partnering ` +
      `closely with engineering and research to ship polished, accessible experiences.`,
    responsibilities: [
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
