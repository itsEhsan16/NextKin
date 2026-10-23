import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { formatPercent, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { AnimatedNumber, ringRadius } from '@/ui/Progress';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Every length in artboard units; each goes through `s()` before it reaches a style. */
export type RingGeometry = {
  ring: number;
  stroke: number;
  avatar: number;
  track: ColorToken;
  /**
   * The pill over the ring's south point. `wide` is for the one string a board never shows:
   * `profileRepo.completeNextStep` adds 0.14 per step from 0.72, so two taps land on a capped 1
   * and the badge reads "100%" — one glyph more than the artboard ever contemplated.
   */
  badge: { width: number; wide: number; height: number; drop: number };
};

/**
 * PROFILE 01 (Figma 1:2194) — 104pt ring, 88pt avatar, the 44×22 "72%" badge.
 *
 * 53.28 is derived, not chosen. Measured against Plus Jakarta Sans Bold, "100%" overruns the 44
 * pill's inner box by 0.04dp at 390 and at every width below it, so the digits meet the border.
 * 53.28 is the width at which the four-character string gets the same 3.44dp of side padding at
 * 390 that the board gives "72%" — the drawn padding, applied to the longer string.
 * `__tests__/theme/typeRamp.test.ts` holds that arithmetic.
 */
export const PROFILE_RING: RingGeometry = {
  ring: 104,
  stroke: 5,
  avatar: 88,
  track: 'surfaceSubtle',
  badge: { width: 44, wide: 53.28, height: 22, drop: 10 },
};

/**
 * PROFILE 03 (577:5350), drawn at 390: an 84 ring with a 4.2 stroke on the border grey, the 72
 * photo inside, and a 34×17 badge. Over 0.75 here; the wide badge keeps PROFILE 01's proportion.
 */
export const EDIT_RING: RingGeometry = {
  ring: 84 / 0.75,
  stroke: 4.2 / 0.75,
  avatar: 72 / 0.75,
  track: 'borderDefault',
  badge: { width: 34 / 0.75, wide: (34 * (53.28 / 44)) / 0.75, height: 17 / 0.75, drop: 8 / 0.75 },
};

export type CompletenessRingProps = {
  completeness: number;
  geometry: RingGeometry;
  /** What sits inside the ring — PROFILE 01's monogram, or PROFILE 03's photo. */
  children: ReactNode;
};

/**
 * An avatar wrapped in the animated completeness ring. One shared value drives the arc sweep and
 * the badge's count-up, so they can never drift (the ScoreRing contract, with an avatar where the
 * number would be).
 */
export function CompletenessRing({ completeness, geometry, children }: CompletenessRingProps) {
  const { colors, motion, radii, sizes, s } = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, completeness));
  // The count-up runs on the UI thread, so the badge cannot size itself from what it is drawing.
  // The resting value is known here, though, and it is the widest string the animation reaches —
  // "100%" is the only four-character one, and every value below it is three.
  const percent = formatPercent(target);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(target, withReducedMotion(reduced, motion.timings.meter)));
  }, [motion.timings.meter, progress, reduced, target]);

  const ring = s(geometry.ring);
  const stroke = s(geometry.stroke);
  const avatar = s(geometry.avatar);
  // Same inset as ScoreRing: a stroke tangent to the canvas edge gets its antialiased fringe
  // shaved, which flattens the circle at 12/3/6/9 o clock. See src/ui/Progress/ringMath.ts.
  const radius = ringRadius(ring, stroke);
  const circumference = 2 * Math.PI * radius;
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  const { badge } = geometry;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Profile ${percent} complete`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[styles.ring, { width: ring, height: ring }]}
    >
      <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
        <Circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          stroke={colors[geometry.track]}
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
        {children}
      </View>

      <View
        style={[
          styles.badge,
          {
            width: s(percent.length > 3 ? badge.wide : badge.width),
            height: s(badge.height),
            bottom: -s(badge.drop),
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

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
