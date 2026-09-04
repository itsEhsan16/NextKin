import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import type { Subscription } from '@/data/models';
import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { ResumeTypeFilter } from '../resumesStore';
import { UsageMeter } from './UsageMeter';

export type ResumesFilterBarProps = {
  typeFilter: ResumeTypeFilter;
  onChangeTypeFilter: (filter: ResumeTypeFilter) => void;
  subscription: Subscription | undefined;
  onPressSort: () => void;
  onPressUpgrade: () => void;
};

/** All / Resumes / Cover Letters (Figma 1:1378). */
const TYPE_PILLS: readonly { key: ResumeTypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'resume', label: 'Resumes' },
  { key: 'cover_letter', label: 'Cover Letters' },
];

const SORT_CHEVRON = 9;

/**
 * Artboard spacing, and the reason it is `marginTop` rather than a container `gap`.
 *
 * The search field 1:1371 ends at 148 and the type pills 1:1378 start at 170; the pills end at
 * 202 and the usage meter 1:1388 starts at 230 — not a uniform rhythm, so no single gap
 * expresses it. `FILTERS_TOP` is also the seam across the pinned/scrolling boundary: it rides on
 * this component's first child, which is the scroll content's first child, so the distance from
 * the pinned search row above is exactly what it was before the split.
 */
const FILTERS_TOP = 22;
const METER_TOP = 28;

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
  onPressSort,
  onPressUpgrade,
}: ResumesFilterBarProps) {
  const { colors, spacing, s } = useTheme();

  return (
    <View>
      <View style={[styles.filterRow, { marginTop: s(FILTERS_TOP) }]}>
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
        <Pressable
          {...a11yButton('Sort by Last edited', 'Changes the document order')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(s(20))}
          onPress={onPressSort}
          style={[styles.sort, { gap: spacing[1] + 2 }]}
        >
          <Text variant="caption" color="textSecondary">
            Last edited
          </Text>
          <FontAwesome5 name="chevron-down" size={s(SORT_CHEVRON)} color={colors.iconMuted} solid />
        </Pressable>
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
  sort: { flexDirection: 'row', alignItems: 'center' },
});
