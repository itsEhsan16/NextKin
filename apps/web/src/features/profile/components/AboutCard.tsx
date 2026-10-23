import type { Profile } from '@nextkin/shared/models';

import { ProfileAccountIllustration } from '@/ui/illustrations';

import { ProfileCard } from './ProfileCard';

/** "About me" (476:645): George's own words, in the running-copy role. */
export function AboutCard({ profile }: { profile: Profile }) {
  return (
    <ProfileCard title="About me" Art={ProfileAccountIllustration} action={{ kind: 'edit' }}>
      {profile.bio ? (
        <p className="mt-3 text-prose text-text-secondary">{profile.bio}</p>
      ) : (
        <p className="mt-3 text-body-m text-text-tertiary">
          Add a few lines about yourself. Job matches and AI suggestions read them.
        </p>
      )}
    </ProfileCard>
  );
}
