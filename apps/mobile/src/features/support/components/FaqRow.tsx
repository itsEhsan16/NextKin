import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { FaqItem } from '@/data/models';
import { a11yButton, hitSlopFor, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';

export type FaqRowProps = {
  item: FaqItem;
  expanded: boolean;
  onToggle: () => void;
};

// One FAQ row at 390 (SUPPORT 01 577:6183 open, 577:6191 closed), in artboard units.
/** The open answer sits in a lavender box inset this far from the card's edge (577:6183). */
const OPEN_INSET = 5 / 0.75;
const OPEN_RADIUS = 14 / 0.75;
const OPEN_PAD_X = 11 / 0.75;
const OPEN_PAD_TOP = 11 / 0.75;
const OPEN_PAD_BOTTOM = 12 / 0.75;
/** A closed row's own padding (577:6191): 15 at the start, 14 at the chevron's end, 11 tall. */
const ROW_PAD_LEFT = 15 / 0.75;
const ROW_PAD_RIGHT = 14 / 0.75;
const ROW_PAD_Y = 11 / 0.75;
/** Question → chevron, and question → answer (577:6185 / 577:6184). */
const GAP = 8 / 0.75;
const CHEVRON = 10 / 0.75;
/** A closed row is 42 tall on the board; the slop makes up the 44pt target. */
const ROW_MIN = 42 / 0.75;

/**
 * One question of the FAQ, drawn as SUPPORT 01's rows: closed, a `menuRow` line and a quiet
 * chevron; open, the same row lifted into a lavender box with the question set semibold, the
 * chevron turned brand, and the answer under it. Nothing measures height — the answer mounts,
 * `LinearTransition` grows the row, the chevron turns on the UI thread (the RubricCard moves).
 */
export function FaqRow({ item, expanded, onToggle }: FaqRowProps) {
  const { colors, motion, sizes, s } = useTheme();
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
    <Animated.View layout={layoutTransition(reduced)} style={expanded ? styles.openFrame : null}>
      <View
        style={
          expanded
            ? [
                styles.open,
                {
                  backgroundColor: colors.brandSurface,
                  borderColor: colors.brandBorder,
                  borderWidth: sizes.border,
                },
              ]
            : null
        }
      >
        {/* Only the question is the button, so a screen reader still reaches the answer. */}
        <Pressable
          {...a11yButton(item.question)}
          accessibilityState={{ expanded }}
          feedback="subtle"
          haptic="selection"
          hitSlop={expanded ? undefined : hitSlopFor(s(ROW_MIN))}
          onPress={onToggle}
          style={[styles.question, expanded ? null : styles.closed]}
        >
          <Text variant={expanded ? 'label' : 'menuRow'} style={styles.fill}>
            {item.question}
          </Text>
          <Animated.View style={chevronStyle}>
            <FontAwesome5
              name="chevron-down"
              size={s(CHEVRON)}
              color={expanded ? colors.brand : colors.iconChevron}
              solid
            />
          </Animated.View>
        </Pressable>

        {expanded ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}>
            <Text variant="captionRegular" color="textBody">
              {item.answer}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  openFrame: { padding: s(OPEN_INSET) },
  open: {
    borderRadius: s(OPEN_RADIUS),
    paddingHorizontal: s(OPEN_PAD_X),
    paddingTop: s(OPEN_PAD_TOP),
    paddingBottom: s(OPEN_PAD_BOTTOM),
    gap: s(GAP),
  },
  closed: {
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(ROW_PAD_Y),
  },
  question: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  fill: { flex: 1 },
}));
