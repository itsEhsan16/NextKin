import { StyleSheet, TextInput, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { a11yButton, hitSlopFor, maxFontScale, useReducedMotion } from '@/lib';
import { motion, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { useFieldChrome } from '@/ui/TextField';

export type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const clearIn = FadeIn.duration(motion.durations.fast);
const clearOut = FadeOut.duration(motion.durations.fast);

/**
 * Figma 1:268 — filled 52pt field, r16, leading search glyph. It shares TextField's chrome: an
 * edge at rest and the selected ink on focus, so a tap visibly lands. Once there is a query, a
 * clear button sits at the end, as every platform search box has one.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Job title, company, skill',
  onSubmit,
  accessibilityLabel = 'Search jobs',
  style,
}: SearchFieldProps) {
  const { colors, radii, sizes, spacing, typography, s } = useTheme();
  const reduced = useReducedMotion();
  const chrome = useFieldChrome(undefined, { rest: colors.borderSoft });
  const clearBox = sizes.iconSm;

  return (
    <Animated.View
      style={[
        styles.field,
        {
          height: sizes.searchField,
          // The redesign's white search pill (§176).
          borderRadius: radii.full,
          borderWidth: sizes.border,
          backgroundColor: colors.surfaceCard,
          paddingHorizontal: s(18),
          gap: spacing[3],
        },
        chrome.borderStyle,
        style,
      ]}
    >
      <Icon name="SearchLg" size="sm" color={colors.textSecondary} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={chrome.onFocus}
        onBlur={chrome.onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.textPrimary}
        cursorColor={colors.textPrimary}
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={maxFontScale.body}
        style={[styles.input, typography.body, { color: colors.textPrimary }]}
      />
      {value.length > 0 ? (
        <Animated.View
          entering={reduced ? undefined : clearIn}
          exiting={reduced ? undefined : clearOut}
        >
          <Pressable
            {...a11yButton('Clear search text')}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlopFor(clearBox)}
            onPress={() => onChangeText('')}
          >
            <Icon name="XCircle" size="sm" color={colors.iconMuted} />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, padding: 0, margin: 0, includeFontPadding: false },
});
