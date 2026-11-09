import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { Period } from './PlanPeriodRow';

type Box = { x: number; width: number };

const TRACK_BORDER = 1;

export type PeriodSwitchProps = {
  value: Period;
  onChange: (period: Period) => void;
  /** "−55%" beside Yearly, when there is a saving to show. */
  yearlyBadge?: string;
};

/** One option: two stacked copies of its words, ink and white, that cross-fade as the pill arrives. */
function Option({
  label,
  badge,
  on,
  onPress,
  onMeasure,
}: {
  label: string;
  badge?: string;
  on: boolean;
  onPress: () => void;
  onMeasure: (box: Box) => void;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.set(reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, motion.timings.base));
  }, [on, reduced, shown]);
  const white = useAnimatedStyle(() => ({ opacity: shown.value }));
  const ink = useAnimatedStyle(() => ({ opacity: 1 - shown.value }));

  const words = (tone: 'ink' | 'white') => (
    <View style={styles.words}>
      <Text variant="bodySemiBold" color={tone === 'white' ? 'textOnBrand' : 'ink'}>
        {label}
      </Text>
      {badge ? (
        <Text variant="footnote" color={tone === 'white' ? 'textOnBrand' : 'success'}>
          {badge}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      feedback="subtle"
      onPress={onPress}
      onLayout={(event: LayoutChangeEvent) =>
        onMeasure({ x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })
      }
      style={styles.option}
    >
      <Animated.View style={ink}>{words('ink')}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, white]}>
        {words('white')}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Monthly / Yearly on the plan screen (§200), with the bottom bar's liquid move (§194, §201): the
 * violet pill's two ends ride different springs, the end in front leaping ahead and the one behind
 * following, so it stretches towards the new choice and draws itself in. No overshoot. Its words
 * cross-fade from ink to white as it arrives. Reduced motion: it moves at once.
 */
export function PeriodSwitch({ value, onChange, yearlyBadge }: PeriodSwitchProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [boxes, setBoxes] = useState<Partial<Record<Period, Box>>>({});
  const measure = (key: Period) => (box: Box) =>
    setBoxes((seen) =>
      seen[key]?.x === box.x && seen[key]?.width === box.width ? seen : { ...seen, [key]: box },
    );

  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const placed = useSharedValue(false);
  const target = boxes[value];

  useEffect(() => {
    if (!target) return;
    // A child's layout counts from the track's outer edge, the pill's position from inside its
    // 1-unit border: take the border off so the pill sits exactly on the option.
    const to = { left: target.x - TRACK_BORDER, right: target.x - TRACK_BORDER + target.width };
    // The first placement, and reduced motion, land at once: nothing to glide from.
    if (reduced || !placed.get()) {
      placed.set(true);
      left.set(to.left);
      right.set(to.right);
      return;
    }
    const goingRight = to.left > left.get();
    left.set(withSpring(to.left, goingRight ? motion.springs.barTrail : motion.springs.barLead));
    right.set(withSpring(to.right, goingRight ? motion.springs.barLead : motion.springs.barTrail));
  }, [left, placed, reduced, right, target]);

  const pill = useAnimatedStyle(() => ({
    opacity: placed.value ? 1 : 0,
    left: left.value,
    width: Math.max(0, right.value - left.value),
  }));

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        { backgroundColor: colors.surfaceCard, borderColor: colors.borderDefault },
      ]}
    >
      <Animated.View
        testID="period-pill"
        pointerEvents="none"
        style={[styles.pill, { backgroundColor: colors.brand }, pill]}
      />
      <Option
        label="Monthly"
        on={value === 'monthly'}
        onPress={() => onChange('monthly')}
        onMeasure={measure('monthly')}
      />
      <Option
        label="Yearly"
        badge={yearlyBadge}
        on={value === 'annual'}
        onPress={() => onChange('annual')}
        onMeasure={measure('annual')}
      />
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  track: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: u(4),
    padding: u(4),
    borderRadius: u(999),
    borderWidth: TRACK_BORDER,
  },
  pill: { position: 'absolute', top: u(4), bottom: u(4), borderRadius: u(999) },
  option: { paddingHorizontal: u(18), paddingVertical: u(9), borderRadius: u(999) },
  words: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  center: { alignItems: 'center', justifyContent: 'center' },
}));
