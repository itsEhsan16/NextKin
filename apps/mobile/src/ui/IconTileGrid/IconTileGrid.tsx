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
   * What the tile stands for, read after its label ("12 Resumes"). Spoken only: nothing under a
   * tile is drawn, so this is the one place the number survives.
   */
  a11yValue?: string;
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
  /** Gap between the icon row and the label. */
  labelGap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Row of equal-width icon tiles — the shared shape behind the Home "Quick Start" and shortcut
 * cards. A tile is an icon and a label, and nothing else.
 *
 * Labels wrap to two lines, which is what lets them be read at all. A one-line label has to fit
 * the cell across its whole string, and the cells are narrow: four across a 390pt frame leaves
 * ~85pt, so "Interview Prep" alone would cap that row. Broken over two lines only the longest
 * *word* has to fit, and the label can be sized to be read instead.
 */
export function IconTileGrid<K extends string = string>({
  items,
  onPress,
  iconBoxHeight,
  iconAlign = 'center',
  labelVariant = 'shortcutLabel',
  labelGap,
  style,
}: IconTileGridProps<K>) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => {
        const spoken = item.a11yValue?.trim();
        return (
          <Pressable
            key={item.key}
            {...a11yButton(spoken ? `${item.label}, ${spoken}` : item.label, item.a11yHint)}
            feedback="scale"
            onPress={() => onPress(item.key)}
            style={styles.item}
          >
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
