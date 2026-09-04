import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SortControlProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const CHEVRON = 9;
/** The control is only as tall as its caption line, so slop is measured off that. */
const ROW_HEIGHT = 20;

/** Figma 1:326 / 1:410 — a muted label plus a small chevron that opens the sort options. */
export function SortControl({ label, onPress, style }: SortControlProps) {
  const { colors, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`Sort by ${label}`, 'Changes the job order')}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlopFor(s(ROW_HEIGHT))}
      onPress={onPress}
      style={[styles.row, { gap: spacing[1] + 2 }, style]}
    >
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <FontAwesome5 name="chevron-down" size={s(CHEVRON)} color={colors.iconMuted} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
