import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { Chip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon, type LineIconName } from '@/ui/Icon';

export type SheetRowProps = {
  /** Untitled UI line icon. Ignored when `art` is given. */
  icon?: LineIconName;
  /**
   * Pre-sized artwork in place of the glyph tile — the create sheet draws its own multi-tone icons
   * with the tile built in (Figma 431:7772 and siblings). It sits in the same 52-wide slot.
   */
  art?: ReactNode;
  label: string;
  description: string;
  /** Shows the "✦ AI" pill after the label. */
  ai?: boolean;
  /**
   * Paywalled action: shows a Pro badge and a lock, and still opens (the caller routes to
   * upgrade).
   */
  locked?: boolean;
  /** Brand-tinted tile + glyph (AI actions) vs the neutral grey tile. */
  tone?: 'neutral' | 'brand';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const TILE = 52;
/** Figma: tile at x=24, label at x=92 → a 16px gutter after the 52px tile. */
const GUTTER = 16;

/**
 * Action row inside the create sheet (Figma 1:1170–1:1195): a 52px rounded icon tile, a
 * semibold label with an optional AI badge, and a muted one-line description.
 */
export function SheetRow({
  icon,
  art,
  label,
  description,
  ai = false,
  locked = false,
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

  // Both badges are hidden from the tree, so the row carries their meaning in its own name and
  // stays one focus stop: "Export as DOCX, Pro feature, button".
  const a11yLabel = [label, ai && 'AI powered', locked && 'Pro feature'].filter(Boolean).join(', ');

  return (
    <Pressable
      {...a11yButton(a11yLabel, description)}
      feedback="subtle"
      onPress={onPress}
      style={[styles.row, { gap: s(GUTTER) }, style]}
    >
      {art ? (
        <View style={[styles.art, { width: s(TILE) }]}>{art}</View>
      ) : (
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
          {icon ? <Icon name={icon} size="md" color={colors[tile.fg]} /> : null}
        </View>
      )}

      <View style={styles.text}>
        <View style={[styles.labelRow, { gap: spacing[2] }]}>
          <Text variant="title" numberOfLines={1} style={styles.label}>
            {label}
          </Text>
          {ai ? <AiBadge /> : null}
          {locked ? (
            // Chip is accessible on its own, unlike AiBadge, so the wrapper does the hiding.
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Chip label="Pro" tone="brand" labelVariant="badge" />
            </View>
          ) : null}
        </View>
        <Text variant="rowDescription" color="textSecondary" numberOfLines={2}>
          {description}
        </Text>
      </View>

      {/* The gate is shown, not enforced: the row opens and the caller routes it to upgrade. */}
      {locked ? <Icon name="Lock01" size="xs" color={colors.iconMuted} /> : null}
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: s(4) },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { flexShrink: 1 },
  art: { alignItems: 'center', justifyContent: 'center' },
}));
