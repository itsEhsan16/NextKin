import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scaledSheet, useTheme } from '@/theme';
import { Button, type ButtonProps } from '@/ui/Button';
import { Text } from '@/ui/Text';

export type StickyActionBarProps = {
  primary: ButtonProps;
  /** Rendered as a ghost button unless the caller overrides variant. */
  secondary?: ButtonProps;
  /** One line above the buttons — "2 generations left this month". Announced politely. */
  note?: string;
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
 * The primary is flexed rather than left to hug its label: `loading` swaps that label for an
 * `ActivityIndicator`, and an unflexed button would collapse to the spinner's width mid-press.
 */
export function StickyActionBar({ primary, secondary, note, style }: StickyActionBarProps) {
  const { colors, shadows, spacing, zIndex } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        shadows.stickyBarUp,
        {
          borderTopColor: colors.borderHairline,
          backgroundColor: colors.surfacePage,
          zIndex: zIndex.stickyBar,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[4],
          paddingBottom: spacing[4] + insets.bottom,
          gap: spacing[3],
        },
        style,
      ]}
    >
      {note ? (
        <Text
          variant="caption"
          color="textSecondary"
          align="center"
          accessibilityLiveRegion="polite"
        >
          {note}
        </Text>
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
