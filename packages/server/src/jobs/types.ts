import { z } from 'zod';

/**
 * The normalized job (ImBackendImplementationPlan P11-01; V2 §17.3, §9.6). Every provider maps its
 * listings to this; the cache stores it (metadata only: a provider's full description never lands
 * in the shared cache, only its snippet), and the apps' `Job` is built from it per user.
 */

export const PROVIDERS = ['adzuna', 'jsearch', 'fixture'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

const salary = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.enum(['USD', 'EUR', 'AUD', 'INR']),
  period: z.enum(['year', 'month', 'hour']),
  estimated: z.boolean().optional(),
});

export const normalizedJobSchema = z.object({
  /** `link`: a job the candidate added from a link. It is theirs: it never enters the shared cache. */
  provider: z.enum([...PROVIDERS, 'link']),
  providerJobId: z.string().min(1).max(200),
  /** The employer's own page when known; else the provider's (tracked) listing URL. */
  applyUrl: z.string().min(1).max(2000),
  /** sha256 of the canonical apply URL; `fixture:<id>` for the local catalogue. */
  applyUrlHash: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(1).max(300),
  company: z.string().min(1).max(200),
  location: z.string().max(200),
  /** ISO 3166 alpha-2. Real providers serve US, DE and AU; the fixture catalogue is Indian too. */
  country: z.string().length(2),
  remote: z.enum(['remote', 'hybrid', 'onsite']),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']),
  experienceYears: z.object({ min: z.number().min(0), max: z.number().min(0) }).optional(),
  salary: salary.optional(),
  postedAt: z.string().min(1),
  closingAt: z.string().optional(),
  descriptionKind: z.enum(['full', 'snippet', 'title_only']),
  /** The full text for the fixture catalogue; a provider's snippet otherwise. */
  description: z.string().max(20000),
  responsibilities: z.array(z.string().max(1000)).max(60),
  requirements: z.array(z.string().max(1000)).max(60),
  benefits: z.array(z.string().max(500)).max(40).optional(),
  perks: z.array(z.string().max(200)).max(40).optional(),
  industries: z.array(z.string().max(200)).max(20).optional(),
  tags: z.array(z.string().max(120)).max(60),
  /** Skill lists read deterministically from the listing (no model): what the match scores against. */
  requiredSkills: z.array(z.string().max(120)).max(60),
  preferredSkills: z.array(z.string().max(120)).max(60),
  reference: z.string().max(200).optional(),
  applicantsCount: z.number().int().min(0).optional(),
  companyProfile: z
    .object({
      logoKey: z.string().max(120).optional(),
      industry: z.string().max(200),
      size: z.string().max(200),
      website: z.string().max(500),
      about: z.string().max(4000).optional(),
      founded: z.number().int().optional(),
      headquarters: z.string().max(200).optional(),
    })
    .strict(),
  attribution: z.object({ label: z.string().min(1).max(80), logoKey: z.string().max(80).optional(), salaryBrand: z.string().max(80).optional() }),
  /** The provider's rank for the query that found it (lower first). */
  rank: z.number().int().min(0),
});
export type NormalizedJob = z.infer<typeof normalizedJobSchema>;

/** What a provider can be asked: the parts of a filter set it serves itself. */
export interface ProviderQuery {
  query?: string;
  location?: string;
  page: number;
}

export interface ProviderCapabilities {
  /** Returns the full description (else a snippet). */
  fullDescription: boolean;
  salary: boolean;
  /** Gives the employer's own apply link (else a tracked redirect). */
  directApply: boolean;
  /** Filters it applies on its side; the rest are applied in memory. */
  filters: readonly ('query' | 'location')[];
}

export interface JobProvider {
  name: ProviderName;
  capabilities: ProviderCapabilities;
  /** How long its listings may be cached (≤ 72 h, the table's CHECK). */
  ttlHours: number;
  search(query: ProviderQuery, signal?: AbortSignal): Promise<NormalizedJob[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
