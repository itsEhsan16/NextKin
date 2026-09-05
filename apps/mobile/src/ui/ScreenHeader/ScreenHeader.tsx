import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

export type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  /** Right-hand action; occupies the slot that otherwise balances the back button. */
  trailing?: ReactNode;
  variant?: 'title' | 'page';
  style?: StyleProp<ViewStyle>;
};

/**
 * The header a pushed screen wears: a back chevron, and the screen's name either centred in that
 * row ('title', as ATS score draws it — Figma 1:2109) or set large underneath it ('page', as
 * Notification preferences draws it — Figma 1:2711). Phase 9A; the two screens above predate it
 * and are pixel-checked against their artboards, so they keep their hand-rolled rows.
 *
 * No horizontal gutter of its own. `Screen` already frames it, by whichever route its branch takes:
 * the scroll branch wraps the `header` slot in `frameStyle`, and the static branch's root spreads
 * the same gutter, width cap and centring over the whole page as `contentStyle`. Adding one here
 * would draw it twice and push the header off the rows below it.
 */
export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Back',
  trailing,
  variant = 'title',
  style,
}: ScreenHeaderProps) {
  const { sizes, spacing } = useTheme();

  // Both slots are one back button wide whether or not anything is in them: that symmetry is the
  // only thing holding the centred title on the screen's centre line rather than the row's.
  const slot: ViewStyle = { width: sizes.iconButton };

  const row = (
    <View style={[styles.row, { paddingTop: spacing[2] }, variant === 'title' ? style : null]}>
      {onBack ? (
        <IconButton icon="chevron-left" label={backLabel} onPress={onBack} />
      ) : (
        <View style={slot} />
      )}
      {variant === 'title' ? (
        <Text
          {...a11yHeader()}
          variant="title"
          align="center"
          numberOfLines={1}
          style={styles.centre}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.centre} />
      )}
      <View style={[styles.trailing, slot]}>{trailing}</View>
    </View>
  );

  // `style` lands on whichever View is outermost, so a caller's margins wrap the whole header.
  if (variant === 'title') return row;

  return (
    <View style={style}>
      {row}
      <Text {...a11yHeader()} variant="pageTitle" style={{ marginTop: spacing[5] }}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  centre: { flex: 1 },
  trailing: { alignItems: 'flex-end' },
});
