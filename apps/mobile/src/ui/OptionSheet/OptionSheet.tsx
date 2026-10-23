import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { a11yHeader, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export type SheetOption<K extends string = string> = {
  key: K;
  label: string;
  /** Muted second line ("Follows your device setting"). */
  caption?: string;
  /**
   * A leading tile (the link kinds, PROFILE 14 577:9800). Give one to any option and the sheet
   * takes the card look below.
   */
  leading?: ReactNode;
};

/**
 * `list` is the plain picker (sort, tone, topic). `card` is the PROFILE 17–20 look (577:53 …
 * 577:1419): each option a rounded row, the picked one washed lavender with a brand check disc.
 */
export type OptionSheetVariant = 'list' | 'card';

export type OptionSheetBodyProps<K extends string = string> = {
  title: string;
  options: readonly SheetOption<K>[];
  selectedKey: K | undefined;
  onSelect: (key: K) => void;
  onClose: () => void;
  variant?: OptionSheetVariant;
  /** The illustrated icon before the title (577:474) — the row's own art, drawn larger. */
  art?: ReactNode;
  /** A quiet centred line under the options (577:503). */
  footnote?: string;
};

const CHECK = 14;

// The card look at 390 (PROFILE 17 577:436), in artboard units.
const CARD_TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const CARD_BOTTOM = 30 / 0.75;
const HEADER_GAP = 10 / 0.75;
const TITLE_TO_SUBTITLE = 2 / 0.75; // TAILOR 01 606:145
const ART_SLOT_W = 44 / 0.75;
const ART_SLOT_H = 40 / 0.75;
const CLOSE = 34 / 0.75;
const CLOSE_GLYPH = 11 / 0.75;
const HEADER_TO_OPTIONS = 10 / 0.75;
const ROW_GAP = 4 / 0.75;
const ROW_RADIUS = 13 / 0.75;
const ROW_PAD_LEFT = 12 / 0.75;
const ROW_PAD_RIGHT = 14 / 0.75;
const ROW_PAD_Y = 16 / 0.75;
const TILED_ROW_PAD_Y = 10 / 0.75;
const OPTIONS_TO_FOOTNOTE = 14 / 0.75;
const CHECK_DISC = 22 / 0.75;
const CHECK_DISC_GLYPH = 10 / 0.75;

/**
 * An option sheet's title row: `headline` and a ✕. Exported so a sheet that shows a loading or
 * empty state before its options can wear the same row, and its title does not jump when the
 * list arrives. The card look leads with art and fills the ✕, as PROFILE 17–20 draw it.
 */
export function OptionSheetHeader({
  title,
  onClose,
  variant = 'list',
  art,
  subtitle,
}: {
  title: string;
  onClose: () => void;
  variant?: OptionSheetVariant;
  art?: ReactNode;
  /** A muted line under the title ("For Senior Product Designer at Stripe", TAILOR 01 606:147). */
  subtitle?: string;
}) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const card = variant === 'card';

  return (
    <View
      style={[
        styles.header,
        card
          ? { gap: s(HEADER_GAP) }
          : { justifyContent: 'space-between', paddingVertical: spacing[3] },
      ]}
    >
      {art ? <View style={styles.artSlot}>{art}</View> : null}
      {subtitle ? (
        <View style={[styles.title, { gap: s(TITLE_TO_SUBTITLE) }]}>
          <Text {...a11yHeader(title)} variant="headline">
            {title}
          </Text>
          <Text variant="micro" color="textSecondary">
            {subtitle}
          </Text>
        </View>
      ) : (
        <Text {...a11yHeader(title)} variant="headline" style={card ? styles.title : null}>
          {title}
        </Text>
      )}
      <IconButton
        icon="times"
        label={`Close ${title.toLowerCase()}`}
        onPress={onClose}
        {...(card
          ? {
              variant: 'filled' as const,
              size: s(CLOSE),
              iconSize: s(CLOSE_GLYPH),
              iconColor: 'textPrimary' as const,
            }
          : null)}
      />
    </View>
  );
}

/**
 * The option list itself — separated from the Sheet so tests can drive it without gestures
 * or animation (the same split FiltersSheetBody uses).
 */
export function OptionSheetBody<K extends string = string>({
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
  variant = 'list',
  art,
  footnote,
}: OptionSheetBodyProps<K>) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const tiled = options.some((option) => option.leading != null);
  const card = variant === 'card' || tiled;

  return (
    <View
      style={[
        { paddingHorizontal: spacing.gutter },
        card
          ? { paddingTop: s(CARD_TOP), paddingBottom: s(CARD_BOTTOM) }
          : { paddingBottom: spacing[4] },
      ]}
    >
      <OptionSheetHeader
        title={title}
        onClose={onClose}
        variant={card ? 'card' : 'list'}
        art={art}
      />

      <View
        accessibilityRole="radiogroup"
        style={card ? { marginTop: s(HEADER_TO_OPTIONS), gap: s(ROW_GAP) } : null}
      >
        {options.map((option) => {
          const selected = option.key === selectedKey;
          return (
            <Pressable
              key={option.key}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              feedback="subtle"
              haptic="selection"
              hitSlop={card ? undefined : hitSlop8}
              onPress={() => onSelect(option.key)}
              style={[
                styles.row,
                card
                  ? [
                      styles.cardRow,
                      { paddingVertical: s(option.leading ? TILED_ROW_PAD_Y : ROW_PAD_Y) },
                      // Every row carries the hairline, clear until picked, so picking one does
                      // not grow it by the border's width.
                      {
                        borderWidth: sizes.border,
                        borderColor: selected ? colors.brandBorder : 'transparent',
                        backgroundColor: selected ? colors.brandSurface : 'transparent',
                      },
                    ]
                  : { minHeight: sizes.listRow },
                { gap: spacing[3] },
              ]}
            >
              {option.leading}
              <View style={styles.labels}>
                <Text
                  variant={card ? (selected ? 'label' : 'menuRow') : 'rowTitle'}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                {option.caption ? (
                  <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                    {option.caption}
                  </Text>
                ) : null}
              </View>
              {selected && card ? (
                <View style={[styles.checkDisc, { backgroundColor: colors.brand }]}>
                  <FontAwesome5
                    name="check"
                    size={s(CHECK_DISC_GLYPH)}
                    color={colors.textOnBrand}
                    solid
                  />
                </View>
              ) : selected ? (
                <FontAwesome5 name="check" size={s(CHECK)} color={colors.textPrimary} solid />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {footnote ? (
        <Text
          variant="rowDescription"
          color="textSecondary"
          align="center"
          style={{ marginTop: s(OPTIONS_TO_FOOTNOTE) }}
        >
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

export type OptionSheetProps<K extends string = string> = OptionSheetBodyProps<K> & {
  open: boolean;
};

/** Single-choice picker sheet (Profile → Appearance / Language / Availability / Min salary). */
export function OptionSheet<K extends string = string>({ open, ...body }: OptionSheetProps<K>) {
  const { sizes } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={sizes.sheetPickerHeight}
      accessibilityLabel={body.title}
    >
      <OptionSheetBody {...body} />
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  artSlot: {
    width: s(ART_SLOT_W),
    height: s(ART_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardRow: {
    borderRadius: s(ROW_RADIUS),
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
  },
  labels: { flex: 1, gap: s(1 / 0.75) },
  checkDisc: {
    width: s(CHECK_DISC),
    height: s(CHECK_DISC),
    borderRadius: s(CHECK_DISC) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
