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
  | 'select'
  /**
   * A filter-sheet option (Figma JOBS 04, 1:768 / 1:774). Boxed like `select` but taller and set
   * in the 14pt segment type, and — unlike `select` — it shows a leading ✓ when picked, because
   * the sheet's groups are multi-select and need to read as checkable rather than as a radio row.
   */
  | 'filter';

export type FilterChipProps = {
  label: string;
  variant?: FilterChipVariant;
  /** `toggle`, `select` and `filter` only: fills the chip (and shows the ✓ on the first and last). */
  selected?: boolean;
  /** FA5 Solid glyph shown before the label (e.g. `map-marker-alt` on a location picker). */
  icon?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const LEADING_ICON = 11;
const TRAILING_ICON = 9;
const TOGGLE_ICON = 10;

/** The bordered-on-white chips; `picker` and `toggle` are the borderless `surfaceSubtle` ones. */
const BOXED: readonly FilterChipVariant[] = ['removable', 'select', 'filter'];

/** Each variant traces a different artboard, so the box metrics are listed rather than derived. */
const PADDING_X: Record<FilterChipVariant, number> = {
  removable: 13,
  picker: 14,
  toggle: 14,
  select: 14,
  filter: 16,
};

const PADDING_Y: Record<FilterChipVariant, number> = {
  removable: 6,
  picker: 8,
  toggle: 8,
  select: 6,
  filter: 10,
};

/**
 * The five chip shapes across the Jobs screens. All are fully rounded; the variant decides the
 * fill, the affordance glyph and what a tap means (remove / open a picker / toggle / pick one of
 * a set / check one of a filter group).
 */
export function FilterChip({
  label,
  variant = 'removable',
  selected = false,
  icon,
  onPress,
  style,
}: FilterChipProps) {
  const { colors, radii, spacing, s } = useTheme();

  const filled = variant !== 'removable' && variant !== 'picker' && selected;
  const boxed = BOXED.includes(variant);
  // `select` is a radio row and reads as picked from its fill alone; `toggle` and `filter` are
  // checkable, so they earn the glyph.
  const checked = (variant === 'toggle' || variant === 'filter') && selected;
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
          paddingHorizontal: PADDING_X[variant],
          paddingVertical: PADDING_Y[variant],
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
      {checked ? (
        <FontAwesome5 name="check" size={s(TOGGLE_ICON)} color={colors.textOnBrand} solid />
      ) : icon ? (
        <FontAwesome5
          name={icon}
          size={s(LEADING_ICON)}
          color={filled ? colors.textOnBrand : colors.textSecondary}
          solid
        />
      ) : null}

      <Text
        // The sheet sets its options in the 14pt segment type; the header chips stay at 13.
        variant={
          variant === 'filter'
            ? filled
              ? 'segmentActive'
              : 'segment'
            : filled
              ? 'captionSemiBold'
              : 'caption'
        }
        color={filled ? 'textOnBrand' : 'textBody'}
        numberOfLines={1}
      >
        {label}
      </Text>

      {variant === 'removable' ? (
        <FontAwesome5 name="times" size={s(TRAILING_ICON)} color={colors.iconMuted} solid />
      ) : variant === 'picker' ? (
        <FontAwesome5 name="chevron-down" size={s(TRAILING_ICON)} color={colors.iconMuted} solid />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
