import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type AddSectionTileProps = {
  /** The section's own label, e.g. "Projects" — the tile reads "Add projects". */
  label: string;
  onPress: () => void;
};

const PLUS = 32;

/**
 * The empty state of one editor section (V2 §7.11). Borrows the dashed "+ New" look the library
 * already uses for its create tile (`NewDocCard`), so an empty section reads as somewhere to
 * write rather than as a section that failed to load.
 */
export function AddSectionTile({ label, onPress }: AddSectionTileProps) {
  const { colors, radii, spacing, s } = useTheme();
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
        {
          gap: spacing[3],
          padding: spacing[4],
          borderRadius: radii.xl,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceFaint,
        },
      ]}
    >
      <View
        style={[
          styles.plus,
          {
            width: s(PLUS),
            height: s(PLUS),
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
          },
        ]}
      >
        <FontAwesome5 name="plus" size={s(13)} color={colors.textOnDark} solid />
      </View>
      <Text variant="label">{copy}</Text>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  tile: {
    borderWidth: s(1),
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
  },
  plus: { alignItems: 'center', justifyContent: 'center' },
}));
