import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SheetRowProps = {
  /** FontAwesome 5 Free Solid glyph name. */
  icon: string;
  label: string;
  description: string;
  /** Shows the "✦ AI" pill after the label. */
  ai?: boolean;
  /** Brand-tinted tile + glyph (AI actions) vs the neutral grey tile. */
  tone?: 'neutral' | 'brand';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const TILE = 52;
const TILE_ICON = 20;
/** Figma: tile at x=24, label at x=92 → a 16px gutter after the 52px tile. */
const GUTTER = 16;

/**
 * Action row inside the create sheet (Figma 1:1170–1:1195): a 52px rounded icon tile, a
 * semibold label with an optional AI badge, and a muted one-line description.
 */
export function SheetRow({
  icon,
  label,
  description,
  ai = false,
  tone = 'neutral',
  onPress,
  style,
}: SheetRowProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const tile: { bg: string; fg: ColorToken } =
    tone === 'brand'
      ? { bg: colors.brandSurface, fg: 'brand' }
      : { bg: colors.surfaceSubtle, fg: 'textPrimary' };

  return (
    <Pressable
      {...a11yButton(ai ? `${label}, AI powered` : label, description)}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[styles.row, { gap: s(GUTTER) }, style]}
    >
      <View
        style={{
          width: s(TILE),
          height: s(TILE),
          borderRadius: radii.xl,
          backgroundColor: tile.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FontAwesome5 name={icon} size={s(TILE_ICON)} color={colors[tile.fg]} solid />
      </View>

      <View style={styles.text}>
        <View style={[styles.labelRow, { gap: spacing[2] }]}>
          <Text variant="title" numberOfLines={1} style={styles.label}>
            {label}
          </Text>
          {ai ? <AiBadge /> : null}
        </View>
        <Text variant="rowDescription" color="textSecondary" numberOfLines={2}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: s(4) },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { flexShrink: 1 },
}));
