import { View, type StyleProp, type ViewStyle } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { Icon, type LineIconName } from '@/ui/Icon';

export type NextStepNoteProps = {
  /** "Next: download it, then apply on stripe.com". */
  text: string;
  /** The tile's FA5 glyph: the external link by default, the wand on ZERO 05 (613:704). */
  icon?: LineIconName;
  style?: StyleProp<ViewStyle>;
};

// The lavender next-step row at 390 (TAILOR 05 609:3, COVER 03 613:1653), in artboard units.
const PAD_L = 12 / 0.75;
const PAD_R = 14 / 0.75;
const PAD_Y = 12 / 0.75;
const GAP = 10 / 0.75;
const RADIUS = 15 / 0.75;
const TILE = 30 / 0.75;
const TILE_RADIUS = 8 / 0.75;

/**
 * What happens after the download: a brand tile with the external-link glyph, then one line.
 * Applying always happens on the employer's own site (V2 §3), so the note points there.
 */
export function NextStepNote({ text, icon = 'LinkExternal01', style }: NextStepNoteProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View
      style={[
        styles.note,
        { backgroundColor: colors.brandSurface, borderColor: colors.brandBorder },
        style,
      ]}
    >
      <View style={[styles.tile, { backgroundColor: colors.tileBrandStrong }]}>
        <Icon name={icon} size="sm" color={colors.brand} />
      </View>
      <Text variant="caption" color="textBody" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(GAP),
    paddingLeft: s(PAD_L),
    paddingRight: s(PAD_R),
    paddingVertical: s(PAD_Y),
    borderRadius: s(RADIUS),
    borderWidth: s(1),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
}));
