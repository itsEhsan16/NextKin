import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { applyUrlHashOf } from '../ids';
import { listingSkills } from '../skills';
import { ProviderError, type JobProvider, type NormalizedJob, type ProviderName, type ProviderQuery } from '../types';

/**
 * The recorded provider (ImBackendImplementationPlan P11-01; toreview §105.18). It replays
 * hand-written, provider-shaped answers from `packages/server/fixtures/jobs/recorded/<provider>/`,
 * keyed by the query (falling back to the provider's `default.json`), and fails loudly when there is
 * no recording at all rather than inventing listings, like the recorded AI provider. No live provider response is committed: Adzuna's terms forbid storing listings
 * beyond display (V2 §7.13), so these are written by hand to the providers' public field shapes.
 */

const recordedListing = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string(),
  country: z.string().length(2),
  remote: z.enum(['remote', 'hybrid', 'onsite']).default('onsite'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']).default('full_time'),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']).default('mid'),
  salary: z.object({ min: z.number().optional(), max: z.number().optional(), currency: z.enum(['USD', 'EUR', 'AUD', 'INR']), period: z.enum(['year', 'month', 'hour']), estimated: z.boolean().optional() }).optional(),
  postedAgoHours: z.number().min(0),
  /** A snippet, or nothing (a title-only listing). */
  snippet: z.string().default(''),
  tags: z.array(z.string()).default([]),
  /** The provider's tracked redirect, or the employer page when the provider gives it. */
  url: z.string().url(),
  companyWebsite: z.string().default(''),
});
const recordingSchema = z.object({ listings: z.array(recordedListing) });

const HERE = dirname(fileURLToPath(import.meta.url));
export function recordingsDir(): string {
  const candidates = [resolve(HERE, '../../../fixtures/jobs/recorded'), resolve(process.cwd(), 'fixtures/jobs/recorded'), resolve(process.cwd(), 'packages/server/fixtures/jobs/recorded')];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0]!;
}

/** The recording a query reads: `default` for no query, else a hash of the normalized query. */
export function recordingKey(query: ProviderQuery): string {
  const text = [query.query?.trim().toLowerCase() ?? '', query.location?.trim().toLowerCase() ?? '', String(query.page)].join('|');
  return text === '||1' ? 'default' : createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const ATTRIBUTION: Record<'adzuna' | 'jsearch', NormalizedJob['attribution']> = {
  adzuna: { label: 'Jobs by Adzuna', logoKey: 'logo-adzuna', salaryBrand: 'Adzuna' },
  jsearch: { label: 'Jobs via JSearch' },
};

export function createRecordedProvider(provider: 'adzuna' | 'jsearch', options: { dir?: string; now?: () => number } = {}): JobProvider {
  return {
    name: provider as ProviderName,
    // It filters nothing on its side: aggregation applies every filter in memory.
    capabilities: { fullDescription: false, salary: provider === 'adzuna', directApply: provider === 'jsearch', filters: [] },
    ttlHours: 24,
    async search(query) {
      if (query.page > 1) return [];
      // A recording for this exact query when one was written, else the provider's default answer.
      const dir = join(options.dir ?? recordingsDir(), provider);
      const specific = join(dir, `${recordingKey(query)}.json`);
      const file = existsSync(specific) ? specific : join(dir, 'default.json');
      if (!existsSync(file)) throw new ProviderError(provider as ProviderName, `no recording for this query (${file})`);
      const { listings } = recordingSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
      const now = options.now?.() ?? Date.now();
      return listings.map((l, rank): NormalizedJob => {
        const skills = listingSkills({ tags: l.tags, requirements: [], responsibilities: [], description: l.snippet });
        return {
          provider: provider as ProviderName,
          providerJobId: l.id,
          applyUrl: l.url,
          applyUrlHash: applyUrlHashOf(l.url),
          title: l.title,
          company: l.company,
          location: l.location,
          country: l.country,
          remote: l.remote,
          employmentType: l.employmentType,
          experienceLevel: l.experienceLevel,
          ...(l.salary ? { salary: l.salary } : {}),
          postedAt: new Date(now - l.postedAgoHours * 3_600_000).toISOString(),
          descriptionKind: l.snippet ? 'snippet' : 'title_only',
          description: l.snippet,
          responsibilities: [],
          requirements: [],
          tags: l.tags,
          requiredSkills: skills.requiredSkills,
          preferredSkills: skills.preferredSkills,
          companyProfile: { industry: '', size: '', website: l.companyWebsite },
          attribution: ATTRIBUTION[provider],
          rank,
        };
      });
    },
  };
}
