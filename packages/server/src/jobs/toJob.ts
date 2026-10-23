import type { Job } from '@nextkin/shared/models/job';

import { jobIdOf } from './ids';
import type { JobMatch } from './matchScore';
import type { NormalizedJob } from './types';

/**
 * A listing as the apps model it (ImBackendImplementationPlan P11-05). The listing is shared cached
 * data; the user's fields (saved state, match) are laid on per request and never written back. The
 * server never sets `companyVerified`: V2 defines no employer verification.
 */

export interface UserDecoration {
  saved?: { savedAt: Date; unavailable: boolean };
  match?: JobMatch | null;
  isPick?: boolean;
  isTodaysPick?: boolean;
}

const KIND: Record<NormalizedJob['descriptionKind'], NonNullable<Job['descriptionKind']>> = { full: 'full', snippet: 'snippet', title_only: 'title' };

export function toClientJob(listing: NormalizedJob, relevanceRank: number, user: UserDecoration = {}): Job {
  const { companyProfile: company, attribution } = listing;
  const match = user.match ?? null;
  return {
    id: jobIdOf(listing.applyUrlHash),
    title: listing.title,
    company: listing.company,
    ...(company.logoKey ? { companyLogoUrl: `asset:${company.logoKey}` } : {}),
    companyIndustry: company.industry,
    companySize: company.size,
    companyWebsite: company.website,
    ...(company.about ? { companyAbout: company.about } : {}),
    ...(company.founded != null ? { companyFounded: company.founded } : {}),
    ...(company.headquarters ? { companyHeadquarters: company.headquarters } : {}),
    location: listing.location,
    remote: listing.remote,
    employmentType: listing.employmentType,
    experienceLevel: listing.experienceLevel,
    ...(listing.experienceYears ? { experienceYears: listing.experienceYears } : {}),
    ...(listing.reference ? { reference: listing.reference } : {}),
    ...(listing.applicantsCount != null ? { applicantsCount: listing.applicantsCount } : {}),
    ...(listing.salary ? { salary: listing.salary } : {}),
    postedAt: listing.postedAt,
    ...(listing.closingAt ? { closingAt: listing.closingAt } : {}),
    source: listing.provider,
    ...(match?.matchScore !== undefined ? { matchScore: match.matchScore } : {}),
    ...(match?.matchBand ? { matchBand: match.matchBand } : {}),
    ...(match ? { matchBasis: match.matchBasis } : {}),
    ...(match?.matchCriteria ? { matchCriteria: match.matchCriteria } : {}),
    ...(match?.matchReason ? { matchReason: match.matchReason } : {}),
    description: listing.description,
    responsibilities: listing.responsibilities,
    requirements: listing.requirements,
    ...(listing.benefits ? { benefits: listing.benefits } : {}),
    ...(listing.perks ? { perks: listing.perks } : {}),
    ...(listing.industries ? { industries: listing.industries } : {}),
    applyUrl: listing.applyUrl,
    descriptionKind: KIND[listing.descriptionKind],
    attribution: {
      provider: listing.provider,
      label: attribution.label,
      ...(attribution.logoKey ? { logoKey: attribution.logoKey } : {}),
      ...(attribution.salaryBrand && listing.salary?.estimated ? { salaryBrand: attribution.salaryBrand } : {}),
    },
    tags: listing.tags,
    isSaved: Boolean(user.saved),
    ...(user.saved ? { savedAt: user.saved.savedAt.toISOString() } : {}),
    ...(user.saved?.unavailable ? { unavailable: true } : {}),
    isPick: Boolean(user.isPick),
    isTodaysPick: Boolean(user.isTodaysPick),
    relevanceRank,
  };
}

/** What a save keeps of a listing (display terms permitting): no full provider description. */
export function snapshotOf(listing: NormalizedJob): NormalizedJob {
  return listing.provider === 'fixture' ? listing : { ...listing, description: listing.description.slice(0, 600) };
}
