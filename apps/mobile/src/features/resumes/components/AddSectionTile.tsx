import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type AddSectionTileProps = {
  /** The section's own label, e.g. "Projects" — the tile reads "Add projects". */
  label: string;
  onPress: () => void;
  /** RESUMES 07's "Add role" stands taller, at 72 (577:8819). */
  style?: StyleProp<ViewStyle>;
};

// RESUMES 06 "Add certifications" at 390 (577:7225), in artboard units.
const HEIGHT = 64 / 0.75;
const RADIUS = 18 / 0.75;
const PAD_X = 15 / 0.75;
const GAP = 12 / 0.75;
const BORDER = 1 / 0.75;
const DISC = 40 / 0.75;
const GLYPH = 14 / 0.75;

/**
 * The empty state of one editor section (V2 §7.11): the dashed lavender tile every redesigned
 * list ends on (RESUMES 06 577:7225, the profile lists' AddCard), so an empty section reads as
 * somewhere to write rather than as a section that failed to load.
 */
export function AddSectionTile({ label, onPress, style }: AddSectionTileProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const copy = `Add ${label.toLowerCase()}`;

  return (
    <Pressable
      {...a11yButton(copy)}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.tile,
        { borderColor: colors.borderDashed, backgroundColor: colors.surfaceNewDoc },
        style,
      ]}
    >
      <View
        style={[styles.disc, { borderRadius: radii.full, backgroundColor: colors.surfaceInverse }]}
      >
        <FontAwesome5 name="plus" size={s(GLYPH)} color={colors.textOnDark} solid />
      </View>
      <Text variant="title" style={styles.fill}>
        {copy}
      </Text>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  tile: {
    minHeight: s(HEIGHT),
    borderRadius: s(RADIUS),
    borderWidth: s(BORDER),
    borderStyle: 'dashed',
    paddingHorizontal: s(PAD_X),
    gap: s(GAP),
    flexDirection: 'row',
    alignItems: 'center',
  },
  disc: { width: s(DISC), height: s(DISC), alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
}));
