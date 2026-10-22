import { EMPLOYMENT_TYPE_LABEL, type Profile } from '@nextkin/shared/models';

import {
  ProfileCompanyIllustration,
  ProfileExperienceIllustration,
  ProfileGoalsIllustration,
  ProfileLocationIllustration,
} from '@/ui/illustrations';

import { preferredLocations } from '../profileLibrary';
import { ProfileCard } from './ProfileCard';

/**
 * "Career preferences" (476:910): the role wanted, where, and what kind of job, each value over
 * its name. One the profile doesn't hold is left out rather than shown empty.
 */
export function CareerPreferencesCard({ profile }: { profile: Profile }) {
  const { desiredRoles, employmentTypes = [] } = profile.preferences;
  const items = [
    {
      key: 'role',
      Art: ProfileExperienceIllustration,
      label: 'Desired role',
      value: desiredRoles[0],
    },
    {
      key: 'location',
      Art: ProfileLocationIllustration,
      label: 'Preferred location',
      value: preferredLocations(profile),
    },
    {
      key: 'type',
      Art: ProfileCompanyIllustration,
      label: 'Job type',
      value: employmentTypes.map((type) => EMPLOYMENT_TYPE_LABEL[type]).join(', ') || undefined,
    },
  ].filter((item) => item.value);

  return (
    <ProfileCard
      title="Career preferences"
      Art={ProfileGoalsIllustration}
      action={{ kind: 'edit' }}
    >
      {items.length === 0 ? (
        <p className="mt-3 text-body-m text-text-tertiary">
          Say what you&apos;re looking for. Job matches start from it.
        </p>
      ) : (
        // The role takes a row of its own, as drawn; the place and the job type share the next.
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-3 [&>div:first-child]:basis-full">
          {items.map(({ key, Art, label, value }) => (
            <div key={key} className="flex items-center gap-2">
              <span aria-hidden className="flex w-6.5 shrink-0 justify-center">
                <Art className="h-auto max-h-5 w-6.5" />
              </span>
              <div className="flex flex-col-reverse">
                <dt className="text-body-s font-semibold text-text-tertiary">{label}</dt>
                <dd className="text-body-m font-semibold text-text-primary">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </ProfileCard>
  );
}
