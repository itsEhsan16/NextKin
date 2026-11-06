import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { a11yButton, hitSlop8, useReducedMotion } from '@/lib';
import { motion, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { type IllustrationName } from '@/ui/illustrations';
import { Illustration } from '@/ui/kit/PageParts';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useShake } from '@/ui/motion';

export type StateViewProps = {
  /** Line icon shown in the tile. Ignored when `illustration` is given. */
  icon?: LineIconName;
  /**
   * A full illustration in place of the icon tile — the Jobs empty states draw one (Figma
   * 395:1079 / 395:1212 / 395:1263). Pre-sized by the caller, and decorative: the title already
   * says everything it shows.
   */
  illustration?: ReactNode;
  /**
   * One of the redesign's illustrations by name (§176). A full-page danger state with neither
   * this nor `illustration` gets the connection-problem art.
   */
  art?: IllustrationName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Quieter text action under the primary button (JOBS 06 "Clear all filters", 1:964). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: 'neutral' | 'danger';
  /** Compact inline variant for section-level states (inside cards). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** 19 drawn over 0.75: the 28 JOBS 06–08 draw under the illustration, less the stack's gap. */
const ILLUSTRATION_GAP = 25.3333;

/** The state rises into place as it fades in, the way loaded sections arrive. */
const arrive = FadeInDown.duration(motion.durations.base);

/** The art settles from just under full size on the gentle spring, a beat after the words. */
const settle: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: motion.scales.settleFrom }] },
    animations: {
      opacity: withTiming(1, motion.timings.base),
      transform: [{ scale: withSpring(1, motion.springs.gentle) }],
    },
  };
};

/**
 * Empty / error state. The full variant mirrors the Figma empty screens (96px r28 icon
 * tile); `compact` fits inside a section card.
 *
 * Motion: when a state replaces something (a skeleton, a list that just emptied) it rises in and
 * its art settles; one that mounts with its page arrives with the page instead (`Screen` skips
 * entrances on first mount). A danger state's tile gives one short nudge — "that didn't work" —
 * and nothing loops, so an empty page reads as finished rather than busy.
 *
 * Accessibility: the container is deliberately NOT `accessible`. Marking it accessible
 * collapses the whole subtree into one element, which swallows the action Button — and on a
 * page-level error state that button is the only recovery path. Instead the title carries the
 * full description (title + message) and the decorative icon / duplicated message are hidden,
 * so a screen reader reads one summary and then reaches the Button as its own element.
 */
export function StateView({
  icon,
  illustration: given,
  art,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = 'neutral',
  compact = false,
  style,
}: StateViewProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  // `sizes.emptyStateTile` arrives scaled, so the compact tile has to be scaled to match.
  const tile = compact ? s(48) : sizes.emptyStateTile;
  const reduced = useReducedMotion();
  const nudge = useShake(tone === 'danger' ? title : null);
  const named = art ?? (!compact && tone === 'danger' && !given ? 'offline' : undefined);
  const illustration = given ?? (named ? <Illustration name={named} size={150} /> : null);

  return (
    <Animated.View
      entering={reduced ? undefined : arrive}
      style={[
        {
          alignItems: 'center',
          paddingVertical: compact ? spacing[4] : spacing[10],
          gap: compact ? spacing[2] : spacing[3],
        },
        style,
      ]}
    >
      {illustration ? (
        <Animated.View
          entering={reduced ? undefined : settle}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          // The boards leave 28 between the drawing and the title, against the 9 the stack's own
          // gap gives the tile — so the illustration carries the difference.
          style={{ marginBottom: s(ILLUSTRATION_GAP) }}
        >
          {illustration}
        </Animated.View>
      ) : icon ? (
        // The settle and the nudge each own a transform, so they sit on two views.
        <Animated.View
          entering={reduced ? undefined : settle}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            style={[
              {
                width: tile,
                height: tile,
                borderRadius: compact ? radii.xl : radii.emptyTile,
                backgroundColor: tone === 'danger' ? colors.dangerSurface : colors.surfaceSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              },
              nudge,
            ]}
          >
            <Icon
              name={icon}
              size={compact ? 'sm' : s(36)}
              color={tone === 'danger' ? colors.danger : colors.iconDefault}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
      <Text
        variant={compact ? 'title3' : 'title2'}
        align="center"
        accessibilityRole="summary"
        accessibilityLabel={message ? `${title}. ${message}` : title}
      >
        {title}
      </Text>
      {message ? (
        <Text
          variant="callout"
          color="textSecondary"
          align="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ maxWidth: s(300) }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === 'danger' ? 'secondary' : 'primary'}
          style={{ marginTop: spacing[2] }}
        />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          {...a11yButton(secondaryLabel)}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlop8}
          onPress={onSecondary}
          style={{ marginTop: spacing[2] }}
        >
          <Text variant="segmentActive" color="textSecondary" align="center">
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
