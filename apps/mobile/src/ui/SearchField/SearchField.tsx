import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { maxFontScale } from '@/lib';
import { useTheme } from '@/theme';

export type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const ICON = 15;

/** Figma 1:268 — filled 52pt field, r16, leading search glyph. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Job title, company, skill',
  onSubmit,
  accessibilityLabel = 'Search jobs',
  style,
}: SearchFieldProps) {
  const { colors, radii, sizes, spacing, typography, s } = useTheme();

  return (
    <View
      style={[
        styles.field,
        {
          height: sizes.searchField,
          borderRadius: radii.xl,
          backgroundColor: colors.surfaceSubtle,
          paddingHorizontal: s(18),
          gap: spacing[3],
        },
        style,
      ]}
    >
      <FontAwesome5 name="search" size={s(ICON)} color={colors.textSecondary} solid />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={maxFontScale.body}
        style={[styles.input, typography.body, { color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, padding: 0, margin: 0, includeFontPadding: false },
});
