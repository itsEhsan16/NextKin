import { View } from 'react-native';

import { EntryTile, ProfileCard } from '@/features/profile/components/cards';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';

import { VsPill, VsRow, VsRule } from './TailorVsCard';

export type BuildVsCardProps = {
  job: { title: string; company: string; meta: string };
  profile: { name: string; avatarUrl?: string; roles: number; skills: number };
  /** Opens the profile editor: the build reads what is there. */
  onEdit: () => void;
};

// The avatar in 663:47's 40 slot at 390, in artboard units.
const AVATAR = 38 / 0.75;

/**
 * BUILD 04b's "This job vs your profile" (663:35): TAILOR 02's card with the profile in the
 * resume's place — the avatar, "Built from / Your profile / 4 roles · 12 skills", and an Edit pill.
 */
export function BuildVsCard({ job, profile, onEdit }: BuildVsCardProps) {
  const { s } = useTheme();
  return (
    <ProfileCard>
      <VsRow
        leading={<EntryTile tile={{ kind: 'letter', name: job.company }} />}
        eyebrow="This job"
        title={job.title}
        meta={job.meta}
      />
      <VsRule />
      <VsRow
        leading={
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Avatar source={profile.avatarUrl} name={profile.name} size={s(AVATAR)} />
          </View>
        }
        eyebrow="Built from"
        title="Your profile"
        meta={`${pluralize(profile.roles, 'role')} · ${pluralize(profile.skills, 'skill')}`}
        trailing={
          <VsPill
            label="Edit"
            spoken="Edit your profile"
            hint="Change what the resume is built from"
            onPress={onEdit}
          />
        }
      />
    </ProfileCard>
  );
}
