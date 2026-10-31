import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import type { InterviewQuestion } from '@/data/models';
import { a11yButton, hitSlopFor, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

export type ModelAnswerProps = {
  question: Pick<InterviewQuestion, 'answer' | 'talkingPoints'>;
  revealed: boolean;
  onToggle: () => void;
};

// INTERVIEW 04 / 05 at 390 (577:3897 closed, 577:4947 open), in artboard units.
const CLOSED_H = 48;
const CLOSED_RADIUS = 13.5;
const OPEN_RADIUS = 15;
const PAD_LEFT = 14;
const CLOSED_PAD_RIGHT = 16;
const OPEN_PAD_RIGHT = 14;
const OPEN_PAD_TOP = 14;
const OPEN_PAD_BOTTOM = 16;
const GAP = 12;
const HEAD_GAP = 10;
const SPARKLE_W = 18;
const SPARKLE_H = 17.632;
const POINTS_GAP = 10;
const TICK = 20;
const TICK_GAP = 10;
/** The open header is one 18 line; its target still reaches 44. */
const HEAD_LINE = 18;

/**
 * The model answer, hidden until asked for (V2 §7.15): closed, a lavender button (577:3897);
 * open, the same panel holding the answer under a rule and the talking points, each on a ticked
 * disc (577:4947). The button and the panel are one surface, so opening grows it in place rather
 * than swapping one box for another.
 */
export function ModelAnswer({ question, revealed, onToggle }: ModelAnswerProps) {
  const { colors, motion, sizes, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const label = revealed ? 'Hide model answer' : 'Reveal model answer';

  return (
    <Animated.View
      layout={layoutTransition(reduced)}
      style={[
        styles.panel,
        revealed ? styles.open : styles.closed,
        {
          backgroundColor: colors.brandSurface,
          borderWidth: sizes.border,
          borderColor: colors.brandBorder,
        },
      ]}
    >
      <Pressable
        {...a11yButton(label)}
        accessibilityState={{ expanded: revealed }}
        feedback="subtle"
        haptic="selection"
        hitSlop={revealed ? hitSlopFor(s(HEAD_LINE / 0.75)) : undefined}
        onPress={onToggle}
        style={[styles.head, revealed ? null : styles.closedHead]}
      >
        <SparkleIcon width={s(SPARKLE_W / 0.75)} height={s(SPARKLE_H / 0.75)} />
        <Text variant="bodySemiBold" color="brand" style={styles.grow}>
          {label}
        </Text>
        <Icon name={revealed ? 'ChevronUp' : 'ChevronDown'} size="md" color={colors.brand} />
      </Pressable>

      {revealed ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          style={styles.body}
        >
          <View style={[styles.rule, { backgroundColor: colors.matchReasonRule }]} />
          <Text variant="body" color="textBody">
            {question.answer}
          </Text>
          {question.talkingPoints.length > 0 ? (
            <View style={styles.points}>
              <Text variant="captionSemiBold" accessibilityRole="header">
                Talking points
              </Text>
              {question.talkingPoints.map((point, index) => (
                <View key={index} style={styles.point}>
                  <View
                    style={[
                      styles.tick,
                      {
                        backgroundColor: colors.surfaceCard,
                        borderWidth: sizes.border,
                        borderColor: colors.brandBorder,
                      },
                    ]}
                  >
                    <Icon name="Check" size="sm" color={colors.brand} />
                  </View>
                  <Text variant="body" color="textBody" style={styles.grow}>
                    {point}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  panel: { paddingLeft: s(PAD_LEFT / 0.75), overflow: 'hidden' },
  closed: {
    borderRadius: s(CLOSED_RADIUS / 0.75),
    paddingRight: s(CLOSED_PAD_RIGHT / 0.75),
  },
  open: {
    borderRadius: s(OPEN_RADIUS / 0.75),
    paddingRight: s(OPEN_PAD_RIGHT / 0.75),
    paddingTop: s(OPEN_PAD_TOP / 0.75),
    paddingBottom: s(OPEN_PAD_BOTTOM / 0.75),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: s(HEAD_GAP / 0.75) },
  // The 48 box less the hairline above and below, so the closed button lands on 48.
  closedHead: { minHeight: s(CLOSED_H / 0.75) - 2 * s(1) },
  grow: { flex: 1 },
  body: { marginTop: s(GAP / 0.75), gap: s(GAP / 0.75) },
  rule: { height: s(1 / 0.75) },
  points: { gap: s(POINTS_GAP / 0.75) },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: s(TICK_GAP / 0.75) },
  tick: {
    width: s(TICK / 0.75),
    height: s(TICK / 0.75),
    borderRadius: s(TICK / 0.75) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
