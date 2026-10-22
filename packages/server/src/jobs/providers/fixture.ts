import type { FixtureListing } from '../fixtureListing';
import { FIXTURE_CATALOGUE } from '../fixtures/catalogue';
import { fixtureHashOf } from '../ids';
import { listingSkills } from '../skills';
import type { JobProvider, NormalizedJob, ProviderQuery } from '../types';

/**
 * The local fixture provider (ImBackendImplementationPlan P11-01; toreview §105.18). It serves the
 * apps' board catalogue as a provider would: full descriptions, employer links where the board has
 * one. Refused in staging and production with the rest of the local stand-ins (L3). It ignores the
 * query on its side and lets aggregation filter in memory, as a provider without a capability would.
 */

const HOUR = 3_600_000;

export function normalizeFixture(listing: FixtureListing, rank: number, now: number): NormalizedJob {
  const skills = listingSkills(listing);
  return {
    provider: 'fixture',
    providerJobId: listing.id,
    applyUrl: listing.applyUrl ?? `https://${listing.companyWebsite}`,
    applyUrlHash: fixtureHashOf(listing.id),
    title: listing.title,
    company: listing.company,
    location: listing.location,
    country: listing.country,
    remote: listing.remote,
    employmentType: listing.employmentType,
    experienceLevel: listing.experienceLevel,
    ...(listing.experienceYears ? { experienceYears: listing.experienceYears } : {}),
    ...(listing.salary ? { salary: listing.salary } : {}),
    postedAt: new Date(now - listing.postedAgoHours * HOUR).toISOString(),
    ...(listing.closingInHours != null ? { closingAt: new Date(now + listing.closingInHours * HOUR).toISOString() } : {}),
    descriptionKind: 'full',
    description: listing.description,
    responsibilities: listing.responsibilities,
    requirements: listing.requirements,
    ...(listing.benefits ? { benefits: listing.benefits } : {}),
    ...(listing.perks ? { perks: listing.perks } : {}),
    ...(listing.industries ? { industries: listing.industries } : {}),
    tags: listing.tags,
    requiredSkills: skills.requiredSkills,
    preferredSkills: skills.preferredSkills,
    ...(listing.reference ? { reference: listing.reference } : {}),
    ...(listing.applicantsCount != null ? { applicantsCount: listing.applicantsCount } : {}),
    companyProfile: {
      ...(listing.logoKey ? { logoKey: listing.logoKey } : {}),
      industry: listing.companyIndustry,
      size: listing.companySize,
      website: listing.companyWebsite,
      ...(listing.companyAbout ? { about: listing.companyAbout } : {}),
      ...(listing.companyFounded != null ? { founded: listing.companyFounded } : {}),
      ...(listing.companyHeadquarters ? { headquarters: listing.companyHeadquarters } : {}),
    },
    attribution: { label: 'Sample listing' },
    rank,
  };
}

export interface FixtureProviderOptions {
  /** A slice of the catalogue (the provider-down drill gives two providers half each). */
  listings?: readonly FixtureListing[];
  now?: () => number;
}

export function createFixtureProvider(options: FixtureProviderOptions = {}): JobProvider {
  const listings = options.listings ?? FIXTURE_CATALOGUE;
  return {
    name: 'fixture',
    capabilities: { fullDescription: true, salary: true, directApply: true, filters: [] },
    ttlHours: 24,
    async search(query: ProviderQuery) {
      if (query.page > 1) return [];
      const now = options.now?.() ?? Date.now();
      return listings.map((listing, index) => normalizeFixture(listing, index, now));
    },
  };
}
