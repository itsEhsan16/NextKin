import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type FilterChipVariant =
  /** Outlined chip with a trailing ✕ — an applied filter you can remove (Figma 1:289). */
  | 'removable'
  /** Filled chip with a trailing ⌄ — opens a picker (Figma 1:276). */
  | 'picker'
  /** Ink-filled chip with a leading ✓ — an active toggle (Figma 1:280). */
  | 'toggle'
  /**
   * One option of a single-choice row — outlined on white when unpicked (Figma 1:530/1:532/1:534),
   * ink-filled with a SemiBold white label and no glyph when picked (Figma 1:528).
   */
  | 'select';

export type FilterChipProps = {
  label: string;
  variant?: FilterChipVariant;
  /** `toggle` and `select` only: fills the chip (and, on `toggle`, shows the check). */
  selected?: boolean;
  /** FA5 Solid glyph shown before the label (e.g. `map-marker-alt` on a location picker). */
  icon?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const LEADING_ICON = 11;
const TRAILING_ICON = 9;
const TOGGLE_ICON = 10;

/** `removable` and `select` are the h32 boxed chips; `picker` and `toggle` are the taller h36 ones. */
const BOXED: readonly FilterChipVariant[] = ['removable', 'select'];

/**
 * The four chip shapes on the Jobs header. All are fully rounded; the variant decides the fill,
 * the affordance glyph and what a tap means (remove / open a picker / toggle / pick one of a set).
 */
export function FilterChip({
  label,
  variant = 'removable',
  selected = false,
  icon,
  onPress,
  style,
}: FilterChipProps) {
  const { colors, radii, spacing } = useTheme();

  const filled = (variant === 'toggle' || variant === 'select') && selected;
  const boxed = BOXED.includes(variant);
  // The picked `select` chip keeps its 1px border — drawn in its own fill — so toggling a chip
  // never shifts the row by 2pt.
  const borderColor = filled ? colors.surfaceSelected : colors.borderDefault;

  const a11y =
    variant === 'removable'
      ? a11yButton(`Remove filter ${label}`)
      : variant === 'picker'
        ? a11yButton(label, 'Opens a picker')
        : { ...a11yButton(label), accessibilityState: { selected } };

  return (
    <Pressable
      {...a11y}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlop8}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radii.full,
          gap: spacing[1] + 2,
          paddingHorizontal: variant === 'removable' ? 13 : 14,
          paddingVertical: boxed ? 6 : 8,
          backgroundColor: filled
            ? colors.surfaceSelected
            : boxed
              ? colors.surfaceCard
              : colors.surfaceSubtle,
          borderWidth: boxed ? 1 : 0,
          borderColor: boxed ? borderColor : 'transparent',
        },
        style,
      ]}
    >
      {variant === 'toggle' && selected ? (
        <FontAwesome5 name="check" size={TOGGLE_ICON} color={colors.textOnBrand} solid />
      ) : icon ? (
        <FontAwesome5
          name={icon}
          size={LEADING_ICON}
          color={filled ? colors.textOnBrand : colors.textSecondary}
          solid
        />
      ) : null}

      <Text
        variant={filled ? 'captionSemiBold' : 'caption'}
        color={filled ? 'textOnBrand' : 'textBody'}
        numberOfLines={1}
      >
        {label}
      </Text>

      {variant === 'removable' ? (
        <FontAwesome5 name="times" size={TRAILING_ICON} color={colors.iconMuted} solid />
      ) : variant === 'picker' ? (
        <FontAwesome5 name="chevron-down" size={TRAILING_ICON} color={colors.iconMuted} solid />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
