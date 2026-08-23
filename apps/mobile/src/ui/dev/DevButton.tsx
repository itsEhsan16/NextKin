import { Pressable, StyleSheet } from 'react-native';

import { a11yButton, haptics } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type DevButtonProps = {
  label: string;
  onPress: () => void;
  /** Filled (selected) vs outlined. */
  active?: boolean;
  /** Stretch to fill a row; default hugs content. */
  grow?: boolean;
};

/** Minimal button for the dev gallery. Not a product component — the real Button lands in Phase 2. */
export function DevButton({ label, onPress, active = false, grow = false }: DevButtonProps) {
  const { colors, spacing, radii, sizes, opacity } = useTheme();

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sizes.minHitTarget,
          paddingHorizontal: spacing[4],
          borderRadius: radii.xl,
          borderColor: active ? colors.brand : colors.borderDefault,
          backgroundColor: active ? colors.brand : colors.surfaceCard,
          opacity: pressed ? opacity.pressed : 1,
        },
        grow && styles.grow,
      ]}
    >
      <Text variant="bodySemiBold" color={active ? 'textOnBrand' : 'textPrimary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  grow: { flex: 1 },
});
