import { StyleSheet, View } from 'react-native';

import { AVAILABILITY_LABEL, type Profile, type User } from '@/data/models';
import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { CompletenessRing, PROFILE_RING } from './CompletenessRing';

export type ProfileIdentityProps = {
  user: User;
  profile: Profile;
  onEdit: () => void;
};

const PILL_PAD_X = 12;
const PILL_PAD_Y = 5;
const DETAILS_GAP = 2;
const PILL_TOP = 8;
/** The availability dot, solid, in the pill's own colour. */
const DOT = 7;

/**
 * Header block of PROFILE 01: ring + avatar, name, headline · city, availability, Edit.
 *
 * Edit sits in the name's row rather than in a column of its own: as a column it took its width
 * from every line beside it, and cut "Senior UX Designer · Bengaluru" off at "Ben…" on a phone.
 */
export function ProfileIdentity({ user, profile, onEdit }: ProfileIdentityProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const availability = profile.preferences.availability;

  return (
    <View style={[styles.row, { gap: spacing[4] }]}>
      {/* PROFILE 01 (1:2198) draws the two-letter monogram, not the photo — deliberately, so the
          ring reads as a progress meter rather than as a frame around a face. The Home header
          (1:6) and Edit profile (577:5353) show the photo. Each follows its own artboard. */}
      <CompletenessRing completeness={profile.completeness} geometry={PROFILE_RING}>
        <Text variant="displayLg" color="textPrimary">
          {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
        </Text>
      </CompletenessRing>

      <View style={[styles.details, { gap: s(DETAILS_GAP) }]}>
        <View style={[styles.nameRow, { gap: spacing[3] }]}>
          <Text variant="displaySemiBold" numberOfLines={1} style={styles.name}>
            {`${user.firstName} ${user.lastName}`}
          </Text>
          <Pressable
            {...a11yButton('Edit profile')}
            feedback="scale"
            haptic="light"
            onPress={onEdit}
            style={{
              borderRadius: radii.full,
              borderWidth: sizes.border,
              borderColor: colors.borderDefault,
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[2] + 1,
            }}
          >
            <Text variant="bodySemiBold">Edit</Text>
          </Pressable>
        </View>
        {profile.headline ? (
          <Text variant="bodyMedium" color="textSecondary" numberOfLines={1}>
            {[profile.headline, profile.location].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {availability !== 'not_looking' ? (
          <View
            accessible
            accessibilityLabel={`Availability: ${AVAILABILITY_LABEL[availability]}`}
            style={[
              styles.pill,
              {
                gap: spacing[1] + s(2),
                paddingHorizontal: s(PILL_PAD_X),
                paddingVertical: s(PILL_PAD_Y),
                borderRadius: radii.full,
                backgroundColor: colors.successSurface,
                marginTop: s(PILL_TOP),
              },
            ]}
          >
            <View
              style={{
                width: s(DOT),
                height: s(DOT),
                borderRadius: radii.full,
                backgroundColor: colors.success,
              }}
            />
            <Text variant="pillStrong" color="success">
              {AVAILABILITY_LABEL[availability]}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  details: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
