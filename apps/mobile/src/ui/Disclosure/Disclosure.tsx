import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, hitSlop8, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

/** Artboard gap between "Show more" and its caret. */
const TOGGLE_GAP = 6;

type DisclosureBase = {
  /** Controlled — the caller owns the state. */
  expanded: boolean;
  onToggle: () => void;
  moreLabel?: string;
  lessLabel?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export type DisclosureProps = DisclosureBase &
  ({ mode?: 'inline'; title?: string } | { mode: 'row'; title: string });

/**
 * The "Show more" accordion from `JobAboutSection` (Figma 1:885), generalised for the Phase 9
 * spec-derived screens: FAQ rows, the ATS score rubric, saved interview answers.
 *
 * Controlled on purpose. The screens that need it already own the state — an FAQ list that keeps
 * one row open at a time, a rubric that collapses when the resume changes — and a second copy
 * kept in here would drift from theirs.
 *
 * `inline` is the job-screen shape: an optional section title, the body, then a text toggle.
 * `row` is the 58pt settings row that opens, for lists of questions.
 *
 * Nothing measures height in either mode: the body mounts, `LinearTransition` animates the
 * container to fit, and the chevron rotates on the UI thread.
 */
export function Disclosure(props: DisclosureProps) {
  const {
    expanded,
    onToggle,
    moreLabel = 'Show more',
    lessLabel = 'Show less',
    children,
    style,
  } = props;
  const { colors, motion, sizes, spacing, s } = useTheme();
  const reduced = useReducedMotion();

  // Driven from a `useEffect` on the JS thread, not a `useDerivedValue`. This began as a derived
  // value whose mapper called `withReducedMotion` on the UI runtime, back when that helper was a
  // plain JS function: the plugin rewrites a captured JS function as a *remote* function, and
  // Worklets refuses to run one synchronously — "Tried to synchronously call a Remote Function" —
  // which took the job detail screen down on mount. `withReducedMotion` is a `'worklet'` now
  // (`src/lib/reducedMotion.ts`), but the effect stays: both inputs (`expanded`, `reduced`) are
  // React state, so there was never anything for a mapper to react to.
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.set(
      withTiming(expanded ? 180 : 0, withReducedMotion(reduced, motion.timings.accordion)),
    );
  }, [expanded, motion.timings.accordion, reduced, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Reduced motion drops the layout transition entirely rather than shortening it: a shorter
  // slide is still a slide, and that is the movement the setting is asking us not to make.
  const layout = layoutTransition(reduced);

  const body = expanded ? (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
      // Collapsing fades the body out while the container closes over it, instead of it vanishing.
      exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
      style={props.mode === 'row' ? { paddingBottom: spacing[3] } : undefined}
    >
      {children}
    </Animated.View>
  ) : null;

  if (props.mode === 'row') {
    return (
      <Animated.View layout={layout} style={style}>
        <Pressable
          {...a11yButton(props.title)}
          accessibilityState={{ expanded }}
          feedback="subtle"
          onPress={onToggle}
          style={[styles.row, { minHeight: sizes.listRow, gap: spacing[3] }]}
        >
          <Text variant="rowTitle" style={styles.rowTitle}>
            {props.title}
          </Text>
          <Animated.View style={chevronStyle}>
            <Icon name="ChevronDown" size="sm" color={colors.iconChevron} />
          </Animated.View>
        </Pressable>
        {body}
      </Animated.View>
    );
  }

  const label = expanded ? lessLabel : moreLabel;

  return (
    <Animated.View layout={layout} style={[{ gap: spacing[4] }, style]}>
      {props.title ? (
        <Text variant="section" accessibilityRole="header">
          {props.title}
        </Text>
      ) : null}

      {body}

      <Pressable
        {...a11yButton(label)}
        accessibilityState={{ expanded }}
        feedback="subtle"
        hitSlop={hitSlop8}
        onPress={onToggle}
        style={[styles.toggle, { gap: s(TOGGLE_GAP) }]}
      >
        <Text variant="captionSemiBold">{label}</Text>
        <Animated.View style={chevronStyle}>
          <Icon name="ChevronDown" size="xs" color={colors.textPrimary} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
