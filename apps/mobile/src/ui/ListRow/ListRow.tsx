import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Fragment, type FC, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/**
 * An illustrated row icon (Figma 399:5885 …): the component and its drawn box on the 390 board.
 * Rows that carry one take the wider art column — see `ART_SLOT`.
 */
export type ListRowArt = { Icon: FC<SvgProps>; w: number; h: number };

export type ListRowProps = (
  | {
      /** FontAwesome 5 Free Solid glyph name. */
      icon: string;
      art?: never;
    }
  | { art: ListRowArt; icon?: never }
) & {
  label: string;
  /** Muted trailing value ("4 roles", "System", "₹24L"). */
  value?: string;
  /** Danger rows (Delete account) tint the icon and label. */
  tone?: 'default' | 'danger';
  showChevron?: boolean;
  onPress: () => void;
  /** Overrides the default "label, value" reading. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const ICON = 16;
const ICON_SLOT = 20;
const CHEVRON = 11;
/** Figma 1:2239: icon at x19, label at x55 → the divider inset below. */
const PADDING_X = 20;
const GUTTER = 16;
const DIVIDER_INSET = PADDING_X + ICON_SLOT + GUTTER;
/**
 * The illustrated column (toreview.md 38.2): icons fit a 48 × 40 box centred at x = 36, and the
 * label and divider start at 72 — 12 in, 48 wide, 12 gutter.
 */
const ART_PADDING_X = 12;
const ART_SLOT = 48;
const ART_GUTTER = 12;
const ART_DIVIDER_INSET = ART_PADDING_X + ART_SLOT + ART_GUTTER;

/** A titled group's overline → card (PROFILE 01/02, NOTIF 04 on the respaced 390 boards). */
const GROUP_TITLE_GAP = 12;

/**
 * 58pt grouped-settings row (Figma PROFILE 01/02): leading glyph, 17pt medium label, muted
 * value, chevron. Compose inside a `RowGroup` for the carded groups with inset dividers.
 */
export function ListRow({
  icon,
  art,
  label,
  value,
  tone = 'default',
  showChevron = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const danger = tone === 'danger';

  return (
    <Pressable
      {...a11yButton(accessibilityLabel ?? (value ? `${label}, ${value}` : label))}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        {
          minHeight: sizes.listRow,
          paddingLeft: s(art ? ART_PADDING_X : PADDING_X),
          paddingRight: s(PADDING_X),
          // Real padding, not only a `minHeight`: the floor alone centres one line in the box and
          // gives a second line nothing to grow into.
          paddingVertical: spacing[2],
          gap: s(art ? ART_GUTTER : GUTTER),
        },
        style,
      ]}
    >
      <View style={[styles.iconSlot, { width: s(art ? ART_SLOT : ICON_SLOT) }]}>
        {art ? (
          <art.Icon width={s(art.w / 0.75)} height={s(art.h / 0.75)} />
        ) : (
          <FontAwesome5
            name={icon}
            size={s(ICON)}
            color={danger ? colors.danger : colors.iconDefault}
            solid
          />
        )}
      </View>
      <Text
        variant="rowTitle"
        color={danger ? 'danger' : 'textPrimary'}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Text>
      {value ? (
        <Text
          variant="segment"
          color="textSecondary"
          numberOfLines={1}
          style={[styles.value, { marginRight: spacing[1] }]}
        >
          {value}
        </Text>
      ) : null}
      {showChevron ? (
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
      ) : null}
    </Pressable>
  );
}

export type RowGroupProps = {
  /** Overline printed above the card ("CAREER PROFILE"). */
  title?: string;
  /** `art` when the rows carry `ListRowArt`, so the dividers start under the label at 72. */
  inset?: 'glyph' | 'art';
  /**
   * Overline → card, in artboard units. Defaults to the 12 the respaced 390 boards draw
   * (PROFILE 01/02, NOTIF 04), so every titled group in the app sits the same distance over its
   * card (toreview.md 54).
   */
  titleGap?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Carded row group (r20 hairline card) with hairline dividers inset past the icon column,
 * exactly as the artboard insets them (x=55).
 */
export function RowGroup({
  title,
  inset = 'glyph',
  titleGap = GROUP_TITLE_GAP,
  children,
  style,
}: RowGroupProps) {
  const { colors, s } = useTheme();
  const rows = Array.isArray(children) ? children : [children];

  return (
    <View style={[{ gap: s(titleGap) }, style]}>
      {title ? (
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card radius="card" padding={0}>
        {rows.filter(Boolean).map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginLeft: s(inset === 'art' ? ART_DIVIDER_INSET : DIVIDER_INSET),
                  backgroundColor: colors.divider,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconSlot: { alignItems: 'center' },
  label: { flex: 1 },
  /**
   * Both are load-bearing, and neither is cosmetic.
   *
   * `flex: 1` on the label means `flexBasis: 0` — it has no width of its own and lives on leftover
   * space. Yoga defaults `flexShrink` to 0 (the web defaults it to 1), so a value with no flex
   * props is unshrinkable at its full measured width, and the label's scaled shrink factor is
   * `1 × 0 = 0`. Nothing can absorb an overflow, so the label resolves to width 0 and vanishes —
   * which is exactly what happened to the education degree on a 390dp phone.
   *
   * `flexShrink` lets the value give way, and `maxWidth` stops it claiming so much that the label
   * is squeezed to a couple of glyphs before shrinking even starts. Every artboard value fits well
   * under the cap, so PROFILE 01/02 renders unchanged; only overflow behaves differently.
   */
  value: { flexShrink: 1, maxWidth: '55%' },
});
