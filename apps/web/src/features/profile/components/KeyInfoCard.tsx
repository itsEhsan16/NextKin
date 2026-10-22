import type { Profile } from '@nextkin/shared/models';

import {
  currentCompany,
  educationLabel,
  experienceBand,
  preferredJobType,
} from '@/features/account/accountLibrary';
import {
  ProfileCompanyIllustration,
  ProfileEducationIllustration,
  ProfileExperienceIllustration,
  ProfileInsightsIllustration,
  ProfileLocationIllustration,
  ProfileTermsIllustration,
} from '@/ui/illustrations';

import { ProfileCard } from './ProfileCard';

const NOT_SPECIFIED = 'Not specified';

/**
 * "Key information" (476:715): six facts as a list, each a duotone glyph, its name and its value.
 * Every value is read off the profile; one it doesn't hold says "Not specified".
 */
export function KeyInfoCard({ profile }: { profile: Profile }) {
  const rows = [
    {
      key: 'title',
      Art: ProfileExperienceIllustration,
      label: 'Job title',
      value: profile.headline,
    },
    {
      key: 'experience',
      Art: ProfileInsightsIllustration,
      label: 'Experience',
      value: experienceBand(profile.yearsExperience),
    },
    {
      key: 'company',
      Art: ProfileCompanyIllustration,
      label: 'Current company',
      value: currentCompany(profile),
    },
    {
      key: 'education',
      Art: ProfileEducationIllustration,
      label: 'Education',
      value: educationLabel(profile),
    },
    {
      key: 'location',
      Art: ProfileLocationIllustration,
      label: 'Location',
      value: profile.location,
    },
    {
      key: 'job-type',
      Art: ProfileTermsIllustration,
      label: 'Preferred job type',
      value: preferredJobType(profile),
    },
  ];

  return (
    <ProfileCard
      title="Key information"
      Art={ProfileInsightsIllustration}
      action={{ kind: 'edit' }}
    >
      <dl className="mt-4 flex flex-col gap-2.5">
        {rows.map(({ key, Art, label, value }) => (
          <div key={key} className="flex min-w-0 items-center gap-3 text-body-l font-semibold">
            <span aria-hidden className="flex w-6.5 shrink-0 justify-center">
              <Art className="h-auto max-h-5 w-6.5" />
            </span>
            <dt className="w-32 shrink-0 text-text-secondary">{label}</dt>
            <dd className="min-w-0 truncate text-text-primary">{value || NOT_SPECIFIED}</dd>
          </div>
        ))}
      </dl>
    </ProfileCard>
  );
}
