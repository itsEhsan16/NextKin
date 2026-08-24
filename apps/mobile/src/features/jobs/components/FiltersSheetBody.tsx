import { ScrollView, StyleSheet, View } from 'react-native';

import {
  SALARY_FILTER_MAX,
  SALARY_FILTER_MIN,
  type EmploymentType,
  type ExperienceLevel,
  type JobSort,
  type PostedWithin,
  type RemoteType,
} from '@/data/models';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';

import {
  EMPLOYMENT_TYPE_OPTIONS,
  EXPERIENCE_OPTIONS,
  POSTED_WITHIN_OPTIONS,
  REMOTE_OPTIONS,
  SORT_SEGMENTS,
  sheetSortValue,
} from '../filterGroups';
import type { JobFilterDraft } from '../jobsStore';
import { FilterPillGroup } from './FilterPillGroup';
import { FiltersActionBar } from './FiltersActionBar';
import { SalaryRangeGroup } from './SalaryRangeGroup';

export type FiltersSheetBodyProps = {
  draft: JobFilterDraft;
  /** Matches for the draft; undefined until the first count resolves, or when it errored. */
  count: number | undefined;
  countLoading: boolean;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  onPostedWithin: (value: PostedWithin | undefined) => void;
  onEmploymentType: (type: EmploymentType) => void;
  onRemote: (type: RemoteType) => void;
  onExperience: (level: ExperienceLevel | undefined) => void;
  onSalary: (min: number, max: number) => void;
  onSort: (sort: JobSort) => void;
};

/**
 * JOBS 04 — Filters (Figma 1:760). Fully controlled and router-free, so it can be exercised in a
 * test harness with no navigation and no store, exactly like `CreateSheetBody`.
 *
 * The body scrolls between a fixed header and a pinned action bar; the sheet hosting it runs in
 * `fill` mode so this column has a real height to flex inside.
 */
export function FiltersSheetBody({
  draft,
  count,
  countLoading,
  onClose,
  onReset,
  onApply,
  onPostedWithin,
  onEmploymentType,
  onRemote,
  onExperience,
  onSalary,
  onSort,
}: FiltersSheetBodyProps) {
  const { colors, spacing } = useTheme();
  const { filters } = draft;

  // An absent bound means the thumb sits on that end stop of the scale.
  const salary: [number, number] = [
    filters.salaryMin ?? SALARY_FILTER_MIN,
    filters.salaryMax ?? SALARY_FILTER_MAX,
  ];

  return (
    <View style={styles.root}>
      <View
        style={[styles.header, { paddingHorizontal: spacing.gutter, paddingVertical: spacing[4] }]}
      >
        <IconButton
          icon="times"
          iconSize={14}
          iconColor="textPrimary"
          size={40}
          variant="filled"
          label="Close filters"
          onPress={onClose}
        />
        {/* Centred across the whole sheet per the artboard, so it is laid over the row rather
            than flowed after the close button. `pointerEvents` keeps it clear of the ✕'s hit area;
            the gutters are symmetric, so centring within them centres it on the sheet. */}
        <View pointerEvents="none" style={styles.title}>
          <Text variant="headline" align="center" accessibilityRole="header">
            Filters
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingVertical: spacing[5],
          gap: spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FilterPillGroup
          title="Date posted"
          options={POSTED_WITHIN_OPTIONS}
          isSelected={(value) => filters.postedWithin === value}
          onToggle={onPostedWithin}
        />
        <FilterPillGroup
          title="Job type"
          options={EMPLOYMENT_TYPE_OPTIONS}
          isSelected={(value) => filters.employmentTypes.includes(value)}
          onToggle={onEmploymentType}
        />
        <FilterPillGroup
          title="Workplace"
          options={REMOTE_OPTIONS}
          isSelected={(value) => filters.remote.includes(value)}
          onToggle={onRemote}
        />
        <SalaryRangeGroup value={salary} onChange={onSalary} />
        <FilterPillGroup
          title="Experience level"
          options={EXPERIENCE_OPTIONS}
          // "Any" is lit precisely when no level is picked.
          isSelected={(value) =>
            value === undefined
              ? filters.experienceLevels.length === 0
              : filters.experienceLevels.includes(value)
          }
          onToggle={onExperience}
        />

        <View style={{ gap: spacing[2] }}>
          <Text variant="groupLabel" accessibilityRole="header">
            Sort by
          </Text>
          <SegmentedControl
            segments={SORT_SEGMENTS}
            value={sheetSortValue(draft.sort)}
            onChange={onSort}
          />
        </View>
      </ScrollView>

      <FiltersActionBar count={count} loading={countLoading} onReset={onReset} onApply={onApply} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { position: 'absolute', left: 0, right: 0 },
  divider: { height: StyleSheet.hairlineWidth },
  body: { flex: 1 },
});
