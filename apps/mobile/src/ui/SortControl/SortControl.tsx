import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type SortControlProps = {
  /** The current order ("Relevance", "Last edited"). */
  label: string;
  /** What changing it does, for the screen reader: "Changes the job order". */
  hint: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The control is only as tall as its caption line, so slop is measured off that. */
const ROW_HEIGHT = 20;

/**
 * A muted label plus a small chevron that opens the sort options — Jobs (Figma 1:326 / 1:410)
 * and Resumes (95:1546) draw the same control, so both lists use this one.
 */
export function SortControl({ label, hint, onPress, style }: SortControlProps) {
  const { colors, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`Sort by ${label}`, hint)}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlopFor(s(ROW_HEIGHT))}
      onPress={onPress}
      style={[styles.row, { gap: spacing[1] + 2 }, style]}
    >
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Icon name="ChevronDown" size="xs" color={colors.iconMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
