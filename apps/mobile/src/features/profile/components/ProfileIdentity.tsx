import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { resolveImageSource } from '@/assets';
import { AVAILABILITY_LABEL, type Profile, type User } from '@/data/models';
import { a11yButton, formatPercent, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { AnimatedNumber } from '@/ui/Progress';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProfileIdentityProps = {
  user: User;
  profile: Profile;
  onEdit: () => void;
};

/**
 * Figma 1:2194 — 104pt ring, 88pt avatar, the 44×22 "72%" badge over the ring's south point.
 * Every constant here is an artboard measurement, so every one goes through `s()` before it
 * reaches a style.
 */
const RING = 104;
const RING_STROKE = 5;
const AVATAR = 88;
const BADGE = { width: 44, height: 22 } as const;
const DOT = 7;
const BADGE_DROP = 8;
const DETAILS_TOP = 8;
const PILL_PAD_X = 12;
const PILL_PAD_Y = 5;
const EDIT_TOP = 8;

/**
 * Avatar wrapped in the animated completeness ring. One shared value drives the arc sweep and
 * the badge's count-up, so they can never drift (the ScoreRing contract, with an avatar where
 * the number would be). PROFILE 01 draws initials; the photo wins when the account has one,
 * with the artboard's two-letter monogram as the fallback.
 */
function CompletenessRing({ user, completeness }: { user: User; completeness: number }) {
  const { colors, motion, radii, sizes, s } = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, completeness));

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(target, withReducedMotion(reduced, motion.timings.meter)));
  }, [motion.timings.meter, progress, reduced, target]);

  const ring = s(RING);
  const stroke = s(RING_STROKE);
  const avatar = s(AVATAR);
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const photo = resolveImageSource(user.avatarUrl);
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Profile ${formatPercent(target)} complete`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[styles.ring, { width: ring, height: ring }]}
    >
      <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
        <Circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          stroke={colors.surfaceSubtle}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          stroke={colors.surfaceInverse}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
          transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
        />
      </Svg>

      <View
        style={{
          width: avatar,
          height: avatar,
          borderRadius: radii.full,
          backgroundColor: colors.surfaceSubtle,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photo ? (
          <Image source={photo} style={{ width: avatar, height: avatar }} contentFit="cover" />
        ) : (
          <Text variant="displayLg" color="textPrimary">
            {initials}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.badge,
          {
            width: s(BADGE.width),
            height: s(BADGE.height),
            bottom: -s(BADGE_DROP),
            borderWidth: sizes.borderThick,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
            borderColor: colors.surfacePage,
          },
        ]}
      >
        {/* The ring's shared value runs 0 → completeness, so ×100 IS the percentage. */}
        <AnimatedNumber
          value={100}
          progress={progress}
          variant="badgeCount"
          color="textOnDark"
          format={(n) => {
            'worklet';
            return `${Math.round(n)}%`;
          }}
        />
      </View>
    </View>
  );
}

/** Header block of PROFILE 01: ring + avatar, name, headline · city, availability, Edit. */
export function ProfileIdentity({ user, profile, onEdit }: ProfileIdentityProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const availability = profile.preferences.availability;

  return (
    <View style={[styles.row, { gap: spacing[4] }]}>
      <CompletenessRing user={user} completeness={profile.completeness} />

      <View style={[styles.details, { gap: spacing[1] + 2, paddingTop: s(DETAILS_TOP) }]}>
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
                gap: spacing[1] + 2,
                paddingHorizontal: s(PILL_PAD_X),
                paddingVertical: s(PILL_PAD_Y),
                borderRadius: radii.full,
                backgroundColor: colors.successSurface,
                marginTop: spacing[1],
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
  ring: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  edit: {},
});
