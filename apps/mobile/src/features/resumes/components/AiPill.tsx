import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useLoop } from '@/ui/motion';

// The "✦ AI" pill at 390 (RESUMES 06 577:6987, RESUMES 09 577:9469), in artboard units.
const HEIGHT = 23 / 0.75;
const GAP = 5 / 0.75;
const PAD_LEFT = 9 / 0.75;
const PAD_RIGHT = 10 / 0.75;
const PAD_Y = 4 / 0.75;
const SPARKLE_W = 12 / 0.75;
const SPARKLE_H = 11.7543 / 0.75;

export type AiPillProps = {
  /**
   * What pressing it does — "Rewrite Skills with AI". Without one the pill is a static mark, as in
   * Fix with AI's header (577:9469).
   */
  actionLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * The AI is working on what this pill started: it stays bright (busy, not unavailable) and its
   * sparkle swells and settles until the work lands.
   */
  working?: boolean;
};

/** The brand-tinted "✦ AI" pill the redesigned resume boards draw on AI actions. */
export function AiPill({ actionLabel, onPress, disabled = false, working = false }: AiPillProps) {
  const { colors, motion, opacity, radii, s } = useTheme();
  const styles = useStyles();
  const beat = useLoop(working, motion.loops.twinkle);
  const grow = motion.scales.twinkle - 1;
  const swell = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + Math.sin(Math.PI * beat.value) * grow }],
  }));

  const content = (
    <>
      <Animated.View style={swell}>
        <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />
      </Animated.View>
      <Text variant="microBadge" color="brand">
        AI
      </Text>
    </>
  );
  const look = [styles.pill, { borderRadius: radii.full, backgroundColor: colors.brandSurface }];

  if (!onPress) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={look}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      {...a11yButton(actionLabel ?? 'AI')}
      accessibilityState={{ disabled, busy: working }}
      feedback="scale"
      haptic="light"
      hitSlop={hitSlopFor(s(HEIGHT))}
      disabled={disabled}
      onPress={onPress}
      style={[look, disabled && !working ? { opacity: opacity.disabled } : null]}
    >
      {content}
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: s(GAP),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
  },
}));
