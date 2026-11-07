import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { SearchField } from '@/ui/SearchField';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import {
  ANYWHERE_IN_INDIA,
  BROAD_LOCATION_OPTIONS,
  filterCityOptions,
  type LocationOption,
} from '../locationOptions';
import { Icon, type LineIconName } from '@/ui/Icon';

export type LocationSheetBodyProps = {
  /** The location currently recorded on the Discover header. */
  value: string;
  onSelect: (location: string) => void;
  onClose: () => void;
};

// JOBS 11 at 390 (580:2834), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const HEADER_TO_FIELD = 10 / 0.75;
const FIELD = 48 / 0.75;
const FIELD_RADIUS = 13.5 / 0.75;
const FIELD_PAD = 14 / 0.75;
const FIELD_TO_OPTIONS = 12 / 0.75;
const ROW = 52 / 0.75;
const ROW_RADIUS = 13 / 0.75;
const ROW_PAD_LEFT = 12 / 0.75;
const ROW_PAD_RIGHT = 14 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
const TILE = 32 / 0.75;
const TILE_RADIUS = 9 / 0.75;
const CHECK_DISC = 22 / 0.75;
const DIVIDER_SPACE = 5 / 0.75;
const DIVIDER_INSET = 12 / 0.75;
/** How deep the option list gets before it scrolls, in rows — the sheet must not fill the screen. */
const VISIBLE_ROWS = 6;

/** Each answer's tile glyph (580:2848 / 580:2853 / 580:2862). */
const glyphFor = (option: LocationOption): LineIconName =>
  option.kind === 'city' ? 'MarkerPin01' : option.value === ANYWHERE_IN_INDIA ? 'Globe04' : 'Wifi';

/**
 * The Discover location picker's contents, drawn as JOBS 11 (580:2834): the card look the option
 * sheets share — a tile per answer, the picked row washed lavender with a brand check disc.
 * Fully controlled and store-free, exactly like `FiltersSheetBody`, so a test can drive it
 * without the sheet's gestures or animation.
 *
 * There is no loading or error state here on purpose: the options are a static list built in
 * `locationOptions.ts`, so there is nothing to fetch and nothing that can fail. The empty state
 * is real — a search term no city matches — and it keeps the field and the two broad answers on
 * screen, because both are still a way out of it.
 */
export function LocationSheetBody({ value, onSelect, onClose }: LocationSheetBodyProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');

  const cities = filterCityOptions(query);

  return (
    <View style={[styles.root, { paddingHorizontal: spacing.gutter }]}>
      <OptionSheetHeader title="Location" onClose={onClose} variant="card" />

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search a city"
        accessibilityLabel="Search locations"
        style={styles.field}
      />

      <ScrollView
        style={[styles.list, { maxHeight: s(ROW) * VISIBLE_ROWS }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="radiogroup">
          {BROAD_LOCATION_OPTIONS.map((option) => (
            <LocationRow
              key={option.value}
              option={option}
              selected={option.value === value}
              onSelect={onSelect}
            />
          ))}

          <View style={styles.dividerWrap}>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          </View>

          {cities.length > 0 ? (
            cities.map((option) => (
              <LocationRow
                key={option.value}
                option={option}
                selected={option.value === value}
                onSelect={onSelect}
              />
            ))
          ) : (
            <StateView
              compact
              icon="SearchLg"
              title="No places match"
              message="Try a shorter spelling, or pick one of the two options above."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function LocationRow({
  option,
  selected,
  onSelect,
}: {
  option: LocationOption;
  selected: boolean;
  onSelect: (location: string) => void;
}) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityLabel={option.value}
      accessibilityState={{ selected }}
      feedback="subtle"
      onPress={() => onSelect(option.value)}
      style={[
        styles.row,
        // Every row carries the hairline, clear until picked, so picking one does not grow it.
        {
          borderWidth: sizes.border,
          borderColor: selected ? colors.brandBorder : 'transparent',
          backgroundColor: selected ? colors.brandSurface : 'transparent',
        },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: colors.tileBrandStrong }]}>
        <Icon name={glyphFor(option)} size="sm" color={colors.brand} />
      </View>
      <Text variant={selected ? 'label' : 'menuRow'} numberOfLines={1} style={styles.label}>
        {option.value}
      </Text>
      {selected ? (
        <View style={[styles.checkDisc, { backgroundColor: colors.brand }]}>
          <Icon name="Check" size="md" color={colors.textOnBrand} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  field: {
    marginTop: s(HEADER_TO_FIELD),
    height: s(FIELD),
    borderRadius: s(FIELD_RADIUS),
    paddingHorizontal: s(FIELD_PAD),
  },
  list: { marginTop: s(FIELD_TO_OPTIONS) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: s(ROW),
    borderRadius: s(ROW_RADIUS),
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(ROW_PAD_Y),
    gap: s(ROW_GAP),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  checkDisc: {
    width: s(CHECK_DISC),
    height: s(CHECK_DISC),
    borderRadius: s(CHECK_DISC) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerWrap: { paddingVertical: s(DIVIDER_SPACE), paddingHorizontal: s(DIVIDER_INSET) },
  divider: { height: s(1) },
}));
