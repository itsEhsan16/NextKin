import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

// The filled switch row at 390 (PROFILE 05 573:232), in artboard units.
const PAD_LEFT = 14 / 0.75;
const PAD_RIGHT = 12 / 0.75;
const PAD_Y = 11 / 0.75;
const GAP = 12 / 0.75;

export type ToggleFieldRowProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/**
 * A switch in a field box — "I currently work here", "I'm still studying here" — filled like the
 * fields above it, so it reads as one more answer on the card.
 */
export function ToggleFieldRow({ label, value, onChange }: ToggleFieldRowProps) {
  const { colors, radii, sizes, s } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: sizes.searchField,
          borderRadius: radii.xl,
          backgroundColor: colors.surfaceSubtle,
          paddingLeft: s(PAD_LEFT),
          paddingRight: s(PAD_RIGHT),
          paddingVertical: s(PAD_Y),
          gap: s(GAP),
        },
      ]}
    >
      <Text variant="menuRow" style={styles.label}>
        {label}
      </Text>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
