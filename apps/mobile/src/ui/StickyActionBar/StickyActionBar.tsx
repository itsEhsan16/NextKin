import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Button, type ButtonProps } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { useShake } from '@/ui/motion';

const noteIn = FadeIn.duration(motion.durations.fast);
const noteOut = FadeOut.duration(motion.durations.fast);

export type StickyActionBarProps = {
  primary: ButtonProps;
  /** Rendered as a ghost button unless the caller overrides variant. */
  secondary?: ButtonProps;
  /** One line above the buttons — "2 generations left this month". Announced politely. */
  note?: string;
  /**
   * `danger` for a note that reports a failure ("We couldn't read that file"): it reads in the
   * danger colour and gives one short nudge as it appears, so it isn't mistaken for a hint.
   */
  noteTone?: 'neutral' | 'danger';
  /**
   * No bar behind the buttons — no fill, hairline or upward shadow (owner, 2026-10-03: "I dont
   * want any background behind the below buttons"; the profile editor boards, toreview.md 53).
   * The bar still sits below the scroller rather than over it, so nothing scrolls under the
   * buttons with nothing to separate them.
   */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The action bar pinned to the foot of a page: an optional note over a ghost secondary and the
 * primary CTA. Job Detail (Figma 1:923) and the ATS score panel (Figma 1:2109) each hand-rolled
 * this; the shape is the same on both, so it lives here once.
 *
 * The bar owns the bottom safe-area inset. `Screen` deliberately stops padding its root once a
 * `footer` is present — the bar's background has to reach the bottom of the glass, not stop at
 * the home indicator — so nothing above adds the inset and the bar must.
 *
 * The primary is flexed to fill the row beside the secondary, as the boards draw it. (It used to
 * be needed for `loading` too, which swapped the label for a spinner; a loading Button now keeps
 * its label laid out under the spinner, so its width holds either way.)
 */
export function StickyActionBar({
  primary,
  secondary,
  note,
  noteTone = 'neutral',
  floating = false,
  style,
}: StickyActionBarProps) {
  const { colors, shadows, spacing, zIndex } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const danger = noteTone === 'danger';
  const nudge = useShake(danger ? note : null);

  return (
    <View
      style={[
        floating ? null : styles.bar,
        floating ? null : shadows.stickyBarUp,
        {
          borderTopColor: colors.borderHairline,
          backgroundColor: floating ? 'transparent' : colors.surfacePage,
          zIndex: zIndex.stickyBar,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[4],
          // Static, keyboard or not. With the keyboard up, the page's keyboard frame lets the keys
          // slide over this inset strip (dead space once the home indicator is covered), so the
          // buttons sit `spacing[4]` above the keys. It used to drop the inset on `keyboardDidShow`,
          // which jumped the bar a beat after the keyboard landed.
          paddingBottom: spacing[4] + insets.bottom,
          gap: spacing[3],
        },
        style,
      ]}
    >
      {note ? (
        // Keyed on the words, so a new note fades in over the old rather than swapping text.
        <Animated.View
          key={note}
          entering={reduced ? undefined : noteIn}
          exiting={reduced ? undefined : noteOut}
        >
          <Animated.View style={danger ? nudge : null}>
            <Text
              variant="caption"
              color={danger ? 'danger' : 'textSecondary'}
              align="center"
              accessibilityLiveRegion="polite"
            >
              {note}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}

      <View style={[styles.row, { gap: spacing[4] }]}>
        {secondary ? (
          <Button
            size="lg"
            variant="ghost"
            {...secondary}
            style={[styles.secondary, secondary.style]}
          />
        ) : null}
        <Button size="lg" block {...primary} style={[styles.primary, primary.style]} />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  /** The Save button's width on Job Detail — fixed, so the primary takes the rest of the row. */
  secondary: { flexBasis: s(140), flexGrow: 0, flexShrink: 0 },
  primary: { flex: 1 },
}));
