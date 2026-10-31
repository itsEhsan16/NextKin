import { z } from 'zod';

import type { Job, JobFilters } from '../models/job';
import { pageSchema } from './page';

/**
 * Jobs on the wire (ImBackendImplementationPlan P11-01…P11-05). The routes and the HTTP repository
 * both read these, so a field the server sends and the app reads cannot drift. A listing is
 * shared cached data; the per-user fields (saved state, match) are added on every response.
 */

const remote = z.enum(['remote', 'hybrid', 'onsite']);
const employment = z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']);
const level = z.enum(['entry', 'mid', 'senior', 'lead']);

export const salaryRangeSchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: z.enum(['USD', 'EUR', 'AUD', 'INR']),
  period: z.enum(['year', 'month', 'hour']),
  estimated: z.boolean().optional(),
});

export const matchBasisSchema = z.object({
  kind: z.enum(['full', 'snippet', 'title']),
  requiredMet: z.number().int().min(0),
  requiredPartial: z.number().int().min(0),
  requiredTotal: z.number().int().min(0),
  preferredMet: z.number().int().min(0),
  preferredTotal: z.number().int().min(0),
  method: z.string().min(1).max(40),
});

export const jobAttributionSchema = z.object({
  provider: z.enum(['adzuna', 'jsearch', 'manual', 'fixture']),
  label: z.string().min(1).max(80),
  logoKey: z.string().max(80).optional(),
  salaryBrand: z.string().max(80).optional(),
});

export const jobSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    company: z.string().min(1).max(200),
    companyLogoUrl: z.string().max(500).optional(),
    companyIndustry: z.string().max(200),
    companySize: z.string().max(200),
    companyWebsite: z.string().max(500),
    companyAbout: z.string().max(4000).optional(),
    companyVerified: z.boolean().optional(),
    companyTagline: z.string().max(300).optional(),
    location: z.string().max(200),
    remote,
    employmentType: employment,
    experienceLevel: level,
    experienceYears: z.object({ min: z.number().min(0), max: z.number().min(0) }).optional(),
    reference: z.string().max(200).optional(),
    applicantsCount: z.number().int().min(0).optional(),
    salary: salaryRangeSchema.optional(),
    postedAt: z.string().min(1),
    source: z.enum(['adzuna', 'jsearch', 'manual', 'fixture']),
    sourceUrl: z.string().max(2000).optional(),
    matchScore: z.number().min(0).max(1).optional(),
    matchBand: z.enum(['strong', 'good', 'fair', 'weak']).optional(),
    matchBasis: matchBasisSchema.optional(),
    matchCriteria: z
      .array(z.object({ id: z.string(), label: z.string(), state: z.enum(['met', 'partial', 'missing', 'optional']), detail: z.string().optional() }))
      .optional(),
    matchReason: z.string().max(400).optional(),
    description: z.string().max(20000),
    responsibilities: z.array(z.string().max(1000)).max(60),
    requirements: z.array(z.string().max(1000)).max(60),
    benefits: z.array(z.string().max(500)).max(40).optional(),
    perks: z.array(z.string().max(200)).max(40).optional(),
    industries: z.array(z.string().max(200)).max(20).optional(),
    companyFounded: z.number().int().optional(),
    companyHeadquarters: z.string().max(200).optional(),
    applyUrl: z.string().max(2000).optional(),
    descriptionKind: z.enum(['full', 'snippet', 'title']).optional(),
    attribution: jobAttributionSchema.optional(),
    unavailable: z.boolean().optional(),
    tags: z.array(z.string().max(120)).max(60),
    isSaved: z.boolean(),
    savedAt: z.string().optional(),
    isPick: z.boolean(),
    isTodaysPick: z.boolean(),
    relevanceRank: z.number().int(),
    closingAt: z.string().optional(),
  })
  .passthrough();

export const jobPageSchema = pageSchema(jobSchema);
export const jobListSchema = z.object({ data: z.array(jobSchema) });
export const jobCountSchema = z.object({ count: z.number().int().min(0) });

/** A save, by the id the listing carries everywhere (search, picks, saved, deep links). */
export const saveJobSchema = z.object({ jobId: z.string().min(1).max(200) }).strict();
export const savedNotesSchema = z.object({ notes: z.string().max(2000) }).strict();

const applicationStatus = z.enum(['applied', 'viewed', 'in_review', 'interview', 'offer', 'not_selected', 'withdrawn']);

export const applicationSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  status: applicationStatus,
  appliedAt: z.string().min(1),
  interviewAt: z.string().optional(),
  resumeId: z.string().optional(),
});
export const applicationListSchema = z.object({ items: z.array(z.object({ application: applicationSchema, job: jobSchema })) });
export const applicationStatusSchema = z.object({ status: applicationStatus }).strict();

export const applicationAskSchema = z.object({ id: z.string().min(1), jobId: z.string().min(1), title: z.string().min(1), company: z.string().min(1) });
export const applicationAsksSchema = z.object({ items: z.array(applicationAskSchema) });
export const applicationAskResultSchema = z.object({ ask: applicationAskSchema.nullable() });
export const applicationAnswerSchema = z.object({ answer: z.enum(['yes', 'not_yet', 'no']) }).strict();
export const applicationTargetSchema = z.union([
  z.object({ jobId: z.string().min(1).max(200), resumeId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ resumeId: z.string().min(1).max(100) }).strict(),
]);

const many = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(item).max(20));

/**
 * Filters as query parameters: repeated keys for the lists (`?remote=remote&remote=hybrid`).
 * Mirrors `JobFilters`; parsing it gives back exactly what `matchesFilters` reads.
 */
export const jobFiltersQuerySchema = z.object({
  query: z.string().max(200).optional(),
  locations: many(z.string().max(120)),
  companies: many(z.string().max(200)),
  remote: many(remote),
  employmentTypes: many(employment),
  experienceLevels: many(level),
  salaryMin: z.coerce.number().int().min(0).max(100_000_000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(100_000_000).optional(),
  postedWithin: z.enum(['24h', '7d', '30d']).optional(),
  tags: many(z.string().max(120)),
});

export const jobSearchQuerySchema = jobFiltersQuerySchema.extend({
  sort: z.enum(['relevance', 'recent', 'salary']).default('relevance'),
  cursor: z.string().max(512).optional(),
});

/** The query string for a filter set, repeated keys for the lists, empty values left out. */
export function jobFiltersToQuery(filters: JobFilters): Record<string, string | string[] | undefined> {
  return {
    query: filters.query?.trim() || undefined,
    locations: filters.locations,
    companies: filters.companies,
    remote: filters.remote,
    employmentTypes: filters.employmentTypes,
    experienceLevels: filters.experienceLevels,
    salaryMin: filters.salaryMin != null ? String(filters.salaryMin) : undefined,
    salaryMax: filters.salaryMax != null ? String(filters.salaryMax) : undefined,
    postedWithin: filters.postedWithin,
    tags: filters.tags,
  };
}

// Compile-time proof that a parsed wire job is assignable to the app's model.
type _JobMatches = z.infer<typeof jobSchema> extends Job ? true : never;
export const JOB_SHAPE_MATCHES: _JobMatches = true;
