import { useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

/** The web's stages for reading a job (`READ_STAGES`, toreview §219). */
export const READ_STAGES = ['Reading the job…', 'Analyzing…', 'Almost there…'] as const;
/** When each stage starts, in ms from the start of the work (the web's `DEFAULT_STAGE_AT`). */
const STAGE_AT = [0, 1500, 5000];
/** The fill never claims to have finished: work with no percentage creeps toward this. */
const CEILING = 0.9;
/** Under reduced motion the fill steps by stage instead of flowing. */
const STEPS = [0.3, 0.6, 0.9];

/**
 * The job step's Continue while the job is read (owner, 2026-11-18, toreview §235): the web's
 * `ProgressButton` in the app's pill. The pill fills from the left, fast then slower, toward 90%
 * (never claiming done), while the label walks through the stages. When the work ends the screen
 * moves on; a failure leaves the plain button again. Idle, it is the ordinary primary pill.
 */
export function ProgressButton({
  label,
  working,
  stages = READ_STAGES,
  disabled,
  onPress,
}: {
  label: string;
  working: boolean;
  stages?: readonly string[];
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);
  const ringId = `ring${useId().replace(/:/g, '')}`;
  const fillId = `fill${useId().replace(/:/g, '')}`;
  const [stage, setStage] = useState(0);
  // A new read starts from the first stage (set while rendering, not after, as the web does).
  const [seen, setSeen] = useState(working);
  if (seen !== working) {
    setSeen(working);
    setStage(0);
  }

  // The stages walk on their own clock: a motion setting that resolves late must not restart it.
  useEffect(() => {
    if (!working) return;
    const timers = STAGE_AT.slice(1, stages.length).map((at, i) =>
      setTimeout(() => setStage(i + 1), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [working, stages.length]);

  useEffect(() => {
    if (!working) {
      cancelAnimation(fill);
      fill.set(0);
      return;
    }
    if (reduced) fill.set(STEPS[0]!);
    else
      fill.set(
        withSequence(
          withTiming(0.55, { duration: STAGE_AT[1], easing: Easing.out(Easing.cubic) }),
          withTiming(CEILING, { duration: 8000, easing: Easing.out(Easing.quad) }),
        ),
      );
  }, [working, reduced, fill]);

  useEffect(() => {
    if (working && reduced) fill.set(STEPS[Math.min(stage, STEPS.length - 1)]!);
  }, [stage, working, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  if (!working) {
    return <Button label={label} size="xl" block disabled={disabled} onPress={onPress} />;
  }
  const now = stages[Math.min(stage, stages.length - 1)] ?? label;
  // Owner, 2026-11-19 (toreview §236): a gradient ring round the pill, and a light lavender fill
  // inside it with the label in brand ink, not a dark pill filling with purple.
  return (
    <View
      style={styles.pill}
      accessible
      accessibilityRole="button"
      accessibilityState={{ busy: true }}
      accessibilityLabel={now}
      accessibilityLiveRegion="polite"
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={ringId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.navGradientStart} />
            <Stop offset="0.5" stopColor={colors.navGradientMid} />
            <Stop offset="1" stopColor={colors.navGradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${ringId})`} />
      </Svg>
      <View style={[styles.inner, { backgroundColor: colors.surfaceCard }]}>
        <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none">
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.brandSurface} />
                <Stop offset="1" stopColor={colors.tileBrandStrong} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${fillId})`} />
          </Svg>
        </Animated.View>
        <Text variant="buttonLabel" color="brand">
          {now}
        </Text>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  pill: {
    height: u(54),
    borderRadius: u(999),
    overflow: 'hidden',
    padding: u(2),
  },
  inner: {
    flex: 1,
    borderRadius: u(999),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
}));
