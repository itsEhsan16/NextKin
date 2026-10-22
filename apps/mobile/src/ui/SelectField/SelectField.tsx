import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SelectFieldProps = {
  label: string;
  /** What is picked. Leave it empty and the placeholder shows, in the placeholder grey. */
  value?: string;
  placeholder?: string;
  /** Leading FA5 Solid glyph — `calendar-alt` on a date, the kind's own glyph on a link. */
  icon?: string;
  /** Spoken after the value — "Opens the month picker". */
  hint: string;
  disabled?: boolean;
  /** False drops the visible label where a card title already names the field (SUPPORT 02 577:7915); it is still spoken. */
  showLabel?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** TextField's box: the same inset and glyph, so a picker sits in a column of inputs unnoticed. */
const INSET = 18;
const ICON = 15;
const CHEVRON = 12;

/**
 * A field that opens a picker instead of a keyboard (PROFILE 05 573:222, PROFILE 13 577:9439): the
 * filled TextField box with a label above, the picked value inside and a chevron at the end. The
 * sheet behind it is the screen's to raise, as a sibling of the page.
 */
export function SelectField({
  label,
  value,
  placeholder,
  icon,
  hint,
  disabled = false,
  showLabel = true,
  onPress,
  style,
}: SelectFieldProps) {
  const { colors, opacity, radii, sizes, spacing, s } = useTheme();
  const shown = value && value.length > 0 ? value : undefined;

  return (
    <View style={[{ gap: spacing[2] }, style]}>
      {showLabel ? (
        <Text variant="groupLabel" importantForAccessibility="no">
          {label}
        </Text>
      ) : null}
      <Pressable
        {...a11yButton(`${label}, ${shown ?? placeholder ?? ''}`, hint)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        feedback="subtle"
        haptic="selection"
        onPress={onPress}
        style={[
          styles.box,
          {
            height: sizes.searchField,
            borderRadius: radii.xl,
            paddingHorizontal: s(INSET),
            gap: spacing[3],
            backgroundColor: colors.surfaceSubtle,
          },
          disabled ? { opacity: opacity.disabled } : null,
        ]}
      >
        {icon ? (
          <FontAwesome5 name={icon} size={s(ICON)} color={colors.textSecondary} solid />
        ) : null}
        <Text
          variant="body"
          color={shown ? 'textPrimary' : 'textSecondary'}
          numberOfLines={1}
          style={styles.value}
        >
          {shown ?? placeholder}
        </Text>
        <FontAwesome5 name="chevron-down" size={s(CHEVRON)} color={colors.textSecondary} solid />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1 },
});
