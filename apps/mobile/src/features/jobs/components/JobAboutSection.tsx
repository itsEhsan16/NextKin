import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, hitSlop8, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobAboutSectionProps = {
  description: string;
  responsibilities: string[];
  requirements: string[];
};

/** Bullets shown before "Show more" (Figma 1:878–1:884 lists four). */
const COLLAPSED_BULLETS = 4;
const BULLET = 5;

function Bullet({ label }: { label: string }) {
  const { colors, radii, spacing, s } = useTheme();
  return (
    <View style={[styles.bulletRow, { gap: spacing[3] }]}>
      <View
        style={{
          width: s(BULLET),
          height: s(BULLET),
          marginTop: spacing[2] + 1,
          borderRadius: radii.full,
          backgroundColor: colors.iconMuted,
        }}
      />
      <Text variant="bulletBody" color="textBody" style={styles.bulletLabel}>
        {label}
      </Text>
    </View>
  );
}

/**
 * "About the role" (Figma 1:875) with the "Show more" accordion (1:885). Collapsed it shows the
 * summary and the first four responsibilities; expanded it adds the rest plus the requirements.
 *
 * The height change rides `LinearTransition` and the chevron rotates on the UI thread, so no
 * layout measurement is needed — the list simply grows and the container animates to fit.
 */
export function JobAboutSection({
  description,
  responsibilities,
  requirements,
}: JobAboutSectionProps) {
  const { colors, spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const hasMore = responsibilities.length > COLLAPSED_BULLETS || requirements.length > 0;
  const bullets = expanded ? responsibilities : responsibilities.slice(0, COLLAPSED_BULLETS);

  const rotation = useDerivedValue(() =>
    withTiming(expanded ? 180 : 0, withReducedMotion(reduced, motion.timings.accordion)),
  );
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      layout={reduced ? undefined : LinearTransition.springify()}
      style={{ gap: spacing[4] }}
    >
      <Text variant="section" accessibilityRole="header">
        About the role
      </Text>
      <Text variant="prose" color="textBody">
        {description}
      </Text>

      <View style={{ gap: spacing[3] }}>
        {bullets.map((label) => (
          <Bullet key={label} label={label} />
        ))}
      </View>

      {expanded && requirements.length > 0 ? (
        <View style={{ gap: spacing[3] }}>
          <Text variant="label" accessibilityRole="header">
            {"What we're looking for"}
          </Text>
          {requirements.map((label) => (
            <Bullet key={label} label={label} />
          ))}
        </View>
      ) : null}

      {hasMore ? (
        <Pressable
          {...a11yButton(expanded ? 'Show less' : 'Show more')}
          accessibilityState={{ expanded }}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlop8}
          onPress={() => setExpanded((current) => !current)}
          style={[styles.toggle, { gap: spacing[2] - 2 }]}
        >
          <Text variant="captionSemiBold">{expanded ? 'Show less' : 'Show more'}</Text>
          <Animated.View style={chevronStyle}>
            <FontAwesome5 name="chevron-down" size={s(9)} color={colors.textPrimary} solid />
          </Animated.View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletLabel: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
