import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
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

const DOT = 7;
const DETAILS_TOP = 10;
const PILL_PAD_X = 12;
const PILL_PAD_Y = 5;
const EDIT_TOP = 18;
const DETAILS_GAP = 2;
const PILL_TOP = 8;

/** Header block of PROFILE 01: ring + avatar, name, headline · city, availability, Edit. */
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

      <View style={[styles.details, { gap: s(DETAILS_GAP), paddingTop: s(DETAILS_TOP) }]}>
        <Text variant="displaySemiBold" numberOfLines={1}>
          {`${user.firstName} ${user.lastName}`}
        </Text>
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
            <FontAwesome5 name="circle" size={s(DOT)} color={colors.success} solid />
            <Text variant="pillStrong" color="success">
              {AVAILABILITY_LABEL[availability]}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        {...a11yButton('Edit profile')}
        feedback="scale"
        haptic="light"
        onPress={onEdit}
        style={[
          styles.edit,
          {
            borderRadius: radii.full,
            borderWidth: sizes.border,
            borderColor: colors.borderDefault,
            marginTop: s(EDIT_TOP),
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[2] + 1,
          },
        ]}
      >
        <Text variant="bodySemiBold">Edit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  details: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  edit: {},
});
