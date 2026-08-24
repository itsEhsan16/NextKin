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
   * Secondary line under the label (a counter or a hint). Pass a blank string to reserve the
   * line while the value loads — blank sublabels are kept out of the accessibility label.
   */
  sublabel?: string;
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
  sublabelVariant?: TypographyRole;
  /** Gap between the icon row and the label. */
  labelGap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Row of equal-width icon tiles with a label and optional sub-label — the shared shape behind
 * the Home "Quick Start" and shortcut cards.
 *
 * Labels wrap to two lines rather than truncating: the Figma artboard is 520pt wide, so a
 * 5-column row that fits there ("Interview Prep") has ~63pt per cell on a 390pt phone.
 */
export function IconTileGrid<K extends string = string>({
  items,
  onPress,
  iconBoxHeight,
  iconAlign = 'center',
  labelVariant = 'microSemiBold',
  sublabelVariant = 'tiny',
  labelGap,
  style,
}: IconTileGridProps<K>) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => {
        const sublabel = item.sublabel?.trim();
        return (
          <Pressable
            key={item.key}
            {...a11yButton(sublabel ? `${item.label}, ${sublabel}` : item.label, item.a11yHint)}
            feedback="scale"
            haptic="light"
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
            {item.sublabel ? (
              <Text variant={sublabelVariant} color="textTertiary" align="center" numberOfLines={2}>
                {item.sublabel}
              </Text>
            ) : null}
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
