import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { a11yHeader, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { SearchField } from '@/ui/SearchField';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { BROAD_LOCATION_OPTIONS, filterCityOptions, type LocationOption } from '../locationOptions';

export type LocationSheetBodyProps = {
  /** The location currently recorded on the Discover header. */
  value: string;
  onSelect: (location: string) => void;
  onClose: () => void;
};

const CHECK = 14;
/** How deep the option list gets before it scrolls, in rows — the sheet must not fill the screen. */
const VISIBLE_ROWS = 6;

/**
 * The Discover location picker's contents. Fully controlled and store-free, exactly like
 * `FiltersSheetBody`, so a test can drive it without the sheet's gestures or animation.
 *
 * There is no loading or error state here on purpose: the options are a static list built in
 * `locationOptions.ts`, so there is nothing to fetch and nothing that can fail. The empty state
 * is real — a search term no city matches — and it keeps the field and the two broad answers on
 * screen, because both are still a way out of it.
 */
export function LocationSheetBody({ value, onSelect, onClose }: LocationSheetBodyProps) {
  const { colors, sizes, spacing } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');

  const cities = filterCityOptions(query);

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing[4], gap: spacing[3] }}>
      <View style={[styles.header, { paddingVertical: spacing[3] }]}>
        <Text {...a11yHeader('Location')} variant="headline">
          Location
        </Text>
        <IconButton icon="times" label="Close location" onPress={onClose} />
      </View>

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search a city"
        accessibilityLabel="Search locations"
      />

      <ScrollView
        style={{ maxHeight: sizes.listRow * VISIBLE_ROWS }}
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

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

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
              icon="search"
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
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityLabel={option.value}
      accessibilityState={{ selected }}
      feedback="subtle"
      haptic="selection"
      // The row is a hair under 44pt once the artboard height is scaled down, so it borrows the
      // rest from its hit slop.
      hitSlop={hitSlop8}
      onPress={() => onSelect(option.value)}
      style={[styles.row, { minHeight: sizes.listRow, gap: spacing[3] }]}
    >
      <Text variant="rowTitle" numberOfLines={1} style={styles.label}>
        {option.value}
      </Text>
      {selected ? (
        <FontAwesome5 name="check" size={s(CHECK)} color={colors.textPrimary} solid />
      ) : null}
    </Pressable>
  );
}

const useStyles = scaledSheet(() => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
}));
