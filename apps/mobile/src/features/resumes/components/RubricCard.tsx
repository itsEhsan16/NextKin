import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ScoreRubricComponent } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { a11yButton, hitSlopFor, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';

export type RubricCardProps = {
  component: ScoreRubricComponent;
  art: ListRowArt;
  expanded: boolean;
  onToggle: () => void;
};

// One rubric component at 390 (RESUMES 10 580:614), in artboard units.
const PAD = 14 / 0.75;
const GAP = 10 / 0.75;
const ICON_SLOT_W = 34 / 0.75;
const ICON_SLOT_H = 30 / 0.75;
const ART_W = 32;
const PILL_PAD_LEFT = 9 / 0.75;
const PILL_PAD_RIGHT = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const CHEVRON_SLOT = 12 / 0.75;
const CHEVRON = 10 / 0.75;

/**
 * One weighted component of the published rubric (V2 §7.8), as a RESUMES 10 card: its drawing,
 * name and weight pill, and a chevron that opens the detail inside the same card. Nothing
 * measures height: the body mounts, `LinearTransition` grows the card, the chevron turns on the
 * UI thread — the same moves `Disclosure` makes.
 */
export function RubricCard({ component, art, expanded, onToggle }: RubricCardProps) {
  const { colors, motion, radii, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const rotation = useSharedValue(expanded ? 180 : 0);
  useEffect(() => {
    rotation.set(
      withTiming(expanded ? 180 : 0, withReducedMotion(reduced, motion.timings.accordion)),
    );
  }, [expanded, motion.timings.accordion, reduced, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View layout={layoutTransition(reduced)}>
      <ProfileCard style={styles.card}>
        <Pressable
          {...a11yButton(`${component.label}, ${component.weight}% of the score`)}
          accessibilityState={{ expanded }}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(s(ICON_SLOT_H))}
          onPress={onToggle}
          style={styles.row}
        >
          <View style={styles.iconSlot}>
            <Art art={art} width={ART_W} />
          </View>
          <Text variant="label" style={styles.fill}>
            {component.label}
          </Text>
          <View
            style={[
              styles.pill,
              { borderRadius: radii.full, backgroundColor: colors.brandSurface },
            ]}
          >
            <Text variant="microBadge" color="brand">
              {`${component.weight}%`}
            </Text>
          </View>
          <View style={styles.chevronSlot}>
            <Animated.View style={chevronStyle}>
              <FontAwesome5
                name="chevron-down"
                size={s(CHEVRON)}
                color={expanded ? colors.textBody : colors.iconMuted}
                solid
              />
            </Animated.View>
          </View>
        </Pressable>

        {expanded ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}>
            <Text variant="body" color="textSecondary">
              {component.detail}
            </Text>
          </Animated.View>
        ) : null}
      </ProfileCard>
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { padding: s(PAD), gap: s(GAP) },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { flex: 1 },
  pill: {
    paddingLeft: s(PILL_PAD_LEFT),
    paddingRight: s(PILL_PAD_RIGHT),
    paddingVertical: s(PILL_PAD_Y),
  },
  chevronSlot: { width: s(CHEVRON_SLOT), alignItems: 'center' },
}));
