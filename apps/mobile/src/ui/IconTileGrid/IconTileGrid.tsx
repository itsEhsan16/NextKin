import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type TypographyRole } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type IconTile<K extends string = string> = {
  key: K;
  label: string;
  /**
   * Live number shown above the icon ("12", "24"). Pass a blank string to hold the row while the
   * value loads, so the icons do not jump once it arrives.
   */
  count?: string;
  /** What a screen reader hears in place of the bare number, e.g. "12 Resumes". */
  countLabel?: string;
  /** Pre-sized icon element — callers own the artwork and its dimensions. */
  icon: ReactNode;
  a11yHint?: string;
};

export type IconTileGridProps<K extends string = string> = {
  items: readonly IconTile<K>[];
  onPress: (key: K) => void;
  /** Fixed height of the icon row so labels align across columns. */
  iconBoxHeight: number;
  /** Bottom-align icons (Quick Start) or centre them (Shortcuts). */
  iconAlign?: 'center' | 'flex-end';
  labelVariant?: TypographyRole;
  countVariant?: TypographyRole;
  /** Gap between the icon row and the label. */
  labelGap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Row of equal-width icon tiles — the shared shape behind the Home "Quick Start" and shortcut
 * cards.
 *
 * Labels wrap to two lines, which is what lets them be read at all. A one-line label has to fit
 * the cell across its whole string, and the cells are narrow: five across a 390pt frame leaves
 * ~64pt, so "Interview Prep" alone caps that row at 9pt. Broken over two lines only the longest
 * *word* has to fit, and the label can be sized to be read instead.
 *
 * A counter sits above the icon rather than under the label, so it never competes with the two
 * lines beneath it. The row is reserved for every tile as soon as one of them has a count, so the
 * icons stay on a common baseline whether or not each tile carries a number.
 */
export function IconTileGrid<K extends string = string>({
  items,
  onPress,
  iconBoxHeight,
  iconAlign = 'center',
  labelVariant = 'shortcutLabel',
  countVariant = 'captionSemiBold',
  labelGap,
  style,
}: IconTileGridProps<K>) {
  const { spacing } = useTheme();
  const styles = useStyles();
  const hasCounts = items.some((item) => item.count != null);

  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => {
        const spoken = item.countLabel?.trim();
        return (
          <Pressable
            key={item.key}
            {...a11yButton(spoken ? `${item.label}, ${spoken}` : item.label, item.a11yHint)}
            feedback="scale"
            haptic="light"
            onPress={() => onPress(item.key)}
            style={styles.item}
          >
            {hasCounts ? (
              <Text variant={countVariant} color="textSecondary" align="center" numberOfLines={1}>
                {item.count ?? ' '}
              </Text>
            ) : null}
            <View style={[styles.iconBox, { height: iconBoxHeight, justifyContent: iconAlign }]}>
              {item.icon}
            </View>
            <Text
              variant={labelVariant}
              align="center"
              numberOfLines={2}
              style={{ marginTop: labelGap ?? spacing[2] }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  grid: { flexDirection: 'row', alignItems: 'flex-start' },
  item: { flex: 1, alignItems: 'center', paddingHorizontal: s(2) },
  iconBox: { alignItems: 'center' },
}));
