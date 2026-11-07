import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { a11yButton, hitSlop8, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { layoutTransition, useSelectionProgress } from '@/ui/motion';
import { Pressable } from '@/ui/Pressable';
import { AnimatedText } from '@/ui/Text';
import { Icon, type LineIconName } from '@/ui/Icon';

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
  | 'filter'
  /**
   * One option of a single-choice row on the Mobile 2 (390) boards — COVER 01's tone chips
   * (613:1510 / 613:1513). Outlined on white when unpicked, ink-filled with a leading ✓ when
   * picked, and announced as a radio so the group reads as mutually exclusive. Opt-in.
   */
  | 'radio';

export type FilterChipProps = {
  label: string;
  variant?: FilterChipVariant;
  /** `toggle`, `select`, `filter` and `radio` only: fills the chip (and shows the ✓ on the first and last). */
  selected?: boolean;
  /** FA5 Solid glyph shown before the label (e.g. `map-marker-alt` on a location picker). */
  icon?: LineIconName;
  /**
   * Accessible name when the visible label is not the whole of it — a bare "Figma" among three
   * chip groups on one page is ambiguous where "Figma, required skill" is not.
   */
  accessibilityLabel?: string;
  /** Overrides the variant's default hint, for a chip that opens something other than a picker. */
  hint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Glyph → label. */
const GLYPH_GAP = 6;

/** The bordered-on-white chips; `picker` and `toggle` are the borderless `surfaceSubtle` ones. */
const BOXED: readonly FilterChipVariant[] = ['removable', 'select', 'filter', 'radio'];

/**
 * Each variant traces a different artboard, so the box metrics are listed rather than derived.
 * Artboard units, scaled at the call site like every other length: raw, they put the chips ~15%
 * over the boards at phone width (JOBS 01 draws the location pill 27 tall at 390, 118:15).
 */
const PADDING_X: Record<FilterChipVariant, number> = {
  removable: 13,
  picker: 14,
  toggle: 14,
  select: 14,
  filter: 16,
  radio: 14 / 0.75, // 613:1510, drawn at 390
};

const PADDING_Y: Record<FilterChipVariant, number> = {
  removable: 6,
  picker: 8,
  toggle: 8,
  select: 6,
  filter: 10,
  radio: 8 / 0.75,
};

const RADIO_GAP = 5 / 0.75;

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
  accessibilityLabel,
  hint,
  onPress,
  style,
}: FilterChipProps) {
  const { colors, motion, radii, sizes, s } = useTheme();
  const reduced = useReducedMotion();

  const fillable = variant !== 'removable' && variant !== 'picker';
  const filled = fillable && selected;
  const boxed = BOXED.includes(variant);
  // `select` is a radio row and reads as picked from its fill alone; `toggle` and `filter` are
  // checkable, so they earn the glyph.
  const checked = (variant === 'toggle' || variant === 'filter' || variant === 'radio') && selected;
  // The picked `select` chip keeps its 1px border — drawn in its own fill — so toggling a chip
  // never shifts the row by 2pt. The fill (border included) fades in over the resting chip, and the
  // label's colour moves with it, so the chip never shows white text on a still-white face.
  const restBackground = boxed ? colors.surfaceCard : colors.surfaceSubtle;
  const border = boxed ? sizes.border : 0;
  const fill = useSelectionProgress(filled);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  const restLabel = colors.textBody;
  const filledLabel = colors.textOnBrand;
  const labelColor = useAnimatedStyle(() => ({
    color: interpolateColor(fill.value, [0, 1], [restLabel, filledLabel]),
  }));

  const name = accessibilityLabel ?? label;
  const a11y =
    variant === 'removable'
      ? a11yButton(`Remove filter ${name}`, hint)
      : variant === 'picker'
        ? a11yButton(name, hint ?? 'Opens a picker')
        : variant === 'radio'
          ? {
              accessible: true,
              accessibilityRole: 'radio' as const,
              accessibilityLabel: name,
              ...(hint ? { accessibilityHint: hint } : {}),
              accessibilityState: { selected },
            }
          : { ...a11yButton(name, hint), accessibilityState: { selected } };

  return (
    <Pressable
      {...a11y}
      feedback="subtle"
      hitSlop={hitSlop8}
      onPress={onPress}
      // A ✓ arriving (or the label's weight changing) resizes the chip; it, and the chips after it
      // in a wrapping row, glide to the new widths.
      layout={layoutTransition(reduced)}
      style={[
        styles.chip,
        {
          borderRadius: radii.full,
          gap: s(variant === 'radio' ? RADIO_GAP : GLYPH_GAP),
          paddingHorizontal: s(PADDING_X[variant]),
          paddingVertical: s(PADDING_Y[variant]),
          backgroundColor: restBackground,
          borderWidth: border,
          borderColor: boxed ? colors.borderDefault : 'transparent',
        },
        style,
      ]}
    >
      {fillable ? (
        <Animated.View
          pointerEvents="none"
          style={[
            // Out over the 1pt border too, so the picked chip's border is its own fill.
            { position: 'absolute', top: -border, left: -border, right: -border, bottom: -border },
            { borderRadius: radii.full, backgroundColor: colors.surfaceSelected },
            fillStyle,
          ]}
        />
      ) : null}
      {checked ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
        >
          <Icon name="Check" size="xs" color={colors.textOnBrand} />
        </Animated.View>
      ) : icon ? (
        <Icon name={icon} size="xs" color={filled ? colors.textOnBrand : colors.textSecondary} />
      ) : null}

      <AnimatedText
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
        colorStyle={labelColor}
        numberOfLines={1}
      >
        {label}
      </AnimatedText>

      {variant === 'removable' ? (
        <Icon name="XClose" size="xs" color={colors.iconMuted} />
      ) : variant === 'picker' ? (
        <Icon name="ChevronDown" size="xs" color={colors.iconMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
