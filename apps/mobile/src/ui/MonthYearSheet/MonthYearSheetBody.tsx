/**
 * The month/year picker itself — separated from the Sheet so tests can drive it without gestures
 * or animation (the OptionSheetBody split).
 *
 * A year strip plus a twelve-chip grid rather than a calendar: the profile fields it feeds store
 * a month, not a day, and every real date picker is a native module Expo Go cannot load. Built
 * from chips the app already ships, so it introduces no new visual language.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { a11yHeader } from '@/lib';
import { columnWidth, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import {
  MONTH_SHORT,
  initialSelection,
  resolveSelection,
  yearOptions,
  type MonthYearValue,
} from './monthYearMath';

export type MonthYearSheetBodyProps = {
  title: string;
  value?: MonthYearValue;
  /** Offers the "still here" switch; the sheet then resolves to the 'present' sentinel. */
  allowPresent?: boolean;
  presentLabel?: string;
  /** Oldest year the strip offers. Defaults to a whole working life back. */
  minYear?: number;
  maxYear?: number;
  onSelect: (value: MonthYearValue) => void;
  onClose: () => void;
};

/** Long enough to cover any career; the strip scrolls, so the extra years cost nothing. */
const YEAR_SPAN = 40;

const MONTH_COLUMNS = 3;

export function MonthYearSheetBody({
  title,
  value,
  allowPresent = false,
  presentLabel = 'I currently work here',
  minYear,
  maxYear,
  onSelect,
  onClose,
}: MonthYearSheetBodyProps) {
  const { contentWidth, opacity, sizes, spacing } = useTheme();

  // One clock reading for the whole sheet: seeding the strip and the selection from two separate
  // `new Date()` calls could straddle midnight and offer a year the selection sits outside.
  const [now] = useState(() => new Date());
  const min = minYear ?? now.getFullYear() - YEAR_SPAN;
  const max = maxYear ?? now.getFullYear();

  const [sel, setSel] = useState(() =>
    initialSelection({ value, allowPresent, minYear: min, maxYear: max, now }),
  );
  const years = useMemo(() => yearOptions(min, max), [min, max]);

  const stripRef = useRef<ScrollView>(null);
  const revealed = useRef(false);
  // The strip starts on the newest year, which is rarely the selected one. Bring the selection
  // into view on its first layout only — a later pass (rotation, Dynamic Type) must not yank the
  // strip back under a finger that has already scrolled it.
  const revealYear = useCallback(
    (event: LayoutChangeEvent) => {
      if (revealed.current) return;
      revealed.current = true;
      stripRef.current?.scrollTo({
        x: Math.max(0, event.nativeEvent.layout.x - spacing.gutter),
        animated: false,
      });
    },
    [spacing.gutter],
  );

  // Nothing to pick while the role is ongoing: the date is "now" by definition.
  const picking = !(allowPresent && sel.present);
  const monthWidth = columnWidth(contentWidth, spacing[2], MONTH_COLUMNS);

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing[4], gap: spacing[4] }}>
      <View style={[styles.header, { paddingVertical: spacing[3] }]}>
        <Text {...a11yHeader(title)} variant="headline">
          {title}
        </Text>
        <IconButton icon="times" label={`Close ${title.toLowerCase()}`} onPress={onClose} />
      </View>

      {allowPresent ? (
        <View style={[styles.presentRow, { minHeight: sizes.listRow, gap: spacing[3] }]}>
          <Text variant="rowTitle" style={styles.presentLabel}>
            {presentLabel}
          </Text>
          <Toggle
            value={sel.present}
            onChange={(present) => setSel((current) => ({ ...current, present }))}
            label={presentLabel}
          />
        </View>
      ) : null}

      <View
        pointerEvents={picking ? 'auto' : 'none'}
        accessibilityElementsHidden={!picking}
        importantForAccessibility={picking ? 'auto' : 'no-hide-descendants'}
        style={{ gap: spacing[4], opacity: picking ? 1 : opacity.disabled }}
      >
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // The strip bleeds back through the sheet's gutters so chips scroll off the screen
          // edge, then pads itself to them again so the first chip lines up with the title.
          style={{ marginHorizontal: -spacing.gutter }}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing.gutter }}
        >
          {years.map((year) => (
            // The chip takes no onLayout of its own, so the measured box is this wrapper's.
            <View key={year} onLayout={year === sel.year ? revealYear : undefined}>
              <FilterChip
                variant="select"
                label={String(year)}
                selected={year === sel.year}
                onPress={() => setSel((current) => ({ ...current, year }))}
              />
            </View>
          ))}
        </ScrollView>

        {/* The group is not itself an accessibility element — that would swallow the chips —
            so the testID is how a test scopes to it. */}
        <View
          testID="month-grid"
          accessibilityRole="radiogroup"
          style={[styles.grid, { gap: spacing[2] }]}
        >
          {MONTH_SHORT.map((label, index) => (
            <FilterChip
              key={label}
              variant="select"
              label={label}
              selected={index + 1 === sel.month}
              onPress={() => setSel((current) => ({ ...current, month: index + 1 }))}
              // `columnWidth` rather than a plain division: three cells that sum to exactly the
              // row can each round up half a pixel and wrap the last one onto its own line.
              style={[styles.month, { width: monthWidth }]}
            />
          ))}
        </View>
      </View>

      <Button
        label="Done"
        size="lg"
        block
        haptic="medium"
        onPress={() => onSelect(resolveSelection(sel, allowPresent))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presentLabel: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // A chip hugs its label; a fixed-width grid cell has to centre it instead.
  month: { justifyContent: 'center' },
});
