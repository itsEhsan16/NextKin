import { StyleSheet, View } from 'react-native';

import { RESUME_SORT_LABEL, type ResumeSort, type Subscription } from '@/data/models';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { SortControl } from '@/ui/SortControl';

import type { ResumeTypeFilter } from '../resumesStore';
import { UsageMeter } from './UsageMeter';

export type ResumesFilterBarProps = {
  typeFilter: ResumeTypeFilter;
  onChangeTypeFilter: (filter: ResumeTypeFilter) => void;
  subscription: Subscription | undefined;
  sort: ResumeSort;
  onPressSort: () => void;
  onPressUpgrade: () => void;
};

/** All / Resumes / Cover Letters (Figma 1:1378). */
const TYPE_PILLS: readonly { key: ResumeTypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'resume', label: 'Resumes' },
  { key: 'cover_letter', label: 'Cover Letters' },
];

/**
 * Artboard spacing, and the reason it is `marginTop` rather than a container `gap`.
 *
 * On the 390 board the search field 95:1532 ends at 119 and the type pills 95:1539 start at 144;
 * the pills end at 168 and the usage meter 95:1549 starts at 196 — 25 and 28, or 33 and 37 in
 * artboard units, so no single gap expresses it. The first is the seam across the
 * pinned/scrolling boundary, shared with Jobs as `sizes.headerContentGap`: it rides on this
 * component's first child, which is the scroll content's first child, so the distance from the
 * pinned search row above is exactly what it was before the split.
 */
const METER_TOP = 37;

/**
 * The part of the Resumes chrome that scrolls: type pills + sort, then the usage meter.
 *
 * Split out of `ResumesHeader` so the title and search rows above it can be pinned; that
 * component is the other half. The wrapper deliberately carries no `gap` — the children bring
 * their own margins and a gap would add to them rather than replace them.
 */
export function ResumesFilterBar({
  typeFilter,
  onChangeTypeFilter,
  subscription,
  sort,
  onPressSort,
  onPressUpgrade,
}: ResumesFilterBarProps) {
  const { sizes, spacing, s } = useTheme();

  return (
    <View>
      <View style={[styles.filterRow, { marginTop: sizes.headerContentGap }]}>
        <View style={[styles.pills, { gap: spacing[2] }]}>
          {TYPE_PILLS.map((pill) => (
            <FilterChip
              key={pill.key}
              label={pill.label}
              variant="select"
              selected={typeFilter === pill.key}
              onPress={() => onChangeTypeFilter(pill.key)}
            />
          ))}
        </View>
        <SortControl
          label={RESUME_SORT_LABEL[sort]}
          hint="Changes the document order"
          onPress={onPressSort}
        />
      </View>

      {subscription ? (
        <UsageMeter
          subscription={subscription}
          onUpgrade={onPressUpgrade}
          style={{ marginTop: s(METER_TOP) }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flexShrink: 1 },
});
