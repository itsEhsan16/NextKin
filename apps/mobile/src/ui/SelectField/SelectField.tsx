import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useFieldChrome } from '@/ui/TextField';
import { useSelectionProgress } from '@/ui/motion';

export type SelectFieldProps = {
  label: string;
  /** What is picked. Leave it empty and the placeholder shows, in the placeholder grey. */
  value?: string;
  placeholder?: string;
  /** Leading line icon — a calendar on a date, the kind's own glyph on a link. */
  icon?: LineIconName;
  /** Spoken after the value — "Opens the month picker". */
  hint: string;
  /** Replaces nothing — there is no helper — but paints the danger edge and is announced once. */
  error?: string;
  /** Its picker is up: the box takes the focused edge and the chevron turns, as a focused input. */
  open?: boolean;
  disabled?: boolean;
  /** False drops the visible label where a card title already names the field (SUPPORT 02 577:7915); it is still spoken. */
  showLabel?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** TextField's box: the same inset and glyph, so a picker sits in a column of inputs unnoticed. */
const INSET = 18;

/**
 * A field that opens a picker instead of a keyboard (PROFILE 05 573:222, PROFILE 13 577:9439): the
 * filled TextField box with a label above, the picked value inside and a chevron at the end. The
 * sheet behind it is the screen's to raise, as a sibling of the page.
 *
 * It shares TextField's chrome — the resting edge, the focused edge while its picker is `open`,
 * and the error edge, caption and announcement — so a required date can fail like any input.
 */
export function SelectField({
  label,
  value,
  placeholder,
  icon,
  hint,
  error,
  open = false,
  disabled = false,
  showLabel = true,
  onPress,
  style,
}: SelectFieldProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const shown = value && value.length > 0 ? value : undefined;
  const chrome = useFieldChrome(error, { rest: colors.borderDefault });
  const turned = useSelectionProgress(open);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turned.value * 180}deg` }],
  }));

  const { onFocus, onBlur } = chrome;
  useEffect(() => {
    if (open) onFocus();
    else onBlur();
    // The handlers are fresh closures each render over the same shared value; only `open` matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <View style={[{ gap: spacing[2] }, style]}>
      {showLabel ? (
        <Text variant="groupLabel" importantForAccessibility="no">
          {label}
        </Text>
      ) : null}
      <Pressable
        {...a11yButton(`${label}, ${shown ?? placeholder ?? ''}`, error ?? hint)}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        feedback="subtle"
        onPress={onPress}
      >
        {/* The box is a child so its animated edge can own borderColor; the Pressable scales it. */}
        <Animated.View
          style={[
            styles.box,
            {
              height: sizes.searchField,
              borderRadius: radii.xl,
              borderWidth: sizes.border,
              paddingHorizontal: s(INSET),
              gap: spacing[3],
              backgroundColor: colors.surfaceSubtle,
            },
            chrome.borderStyle,
          ]}
        >
          {icon ? <Icon name={icon} size="sm" color={colors.textSecondary} /> : null}
          <Text
            variant="body"
            color={shown ? 'textPrimary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.value}
          >
            {shown ?? placeholder}
          </Text>
          <Animated.View style={chevronStyle}>
            <Icon name="ChevronDown" size="sm" color={colors.textSecondary} />
          </Animated.View>
        </Animated.View>
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1 },
});
