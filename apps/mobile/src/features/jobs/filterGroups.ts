import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  POSTED_WITHIN_LABEL,
  REMOTE_TYPE_LABEL,
  SALARY_FILTER_MAX,
  SALARY_FILTER_MIN,
  SALARY_FILTER_STEP,
  type EmploymentType,
  type ExperienceLevel,
  type JobSort,
  type PostedWithin,
  type RemoteType,
} from '@/data/models';
import type { Segment } from '@/ui/SegmentedControl';

/** One pill in a filter group. `id` is separate from `value` because "Any" carries no value. */
export type FilterOption<T> = { id: string; value: T; label: string };

/** "Date posted" (Figma 1:767). `undefined` is the artboard's selected "Any time". */
export const POSTED_WITHIN_OPTIONS: readonly FilterOption<PostedWithin | undefined>[] = [
  { id: '24h', value: '24h', label: POSTED_WITHIN_LABEL['24h'] },
  { id: '7d', value: '7d', label: POSTED_WITHIN_LABEL['7d'] },
  { id: '30d', value: '30d', label: POSTED_WITHIN_LABEL['30d'] },
  { id: 'any', value: undefined, label: 'Any time' },
];

/**
 * "Job type" (Figma 1:778) — four of the model's five employment types. Freelance exists in the
 * data model but is not on the artboard, so the list is written out rather than derived from the
 * label record, which would silently grow a fifth pill.
 */
export const EMPLOYMENT_TYPE_OPTIONS: readonly FilterOption<EmploymentType>[] = (
  ['full_time', 'part_time', 'contract', 'internship'] as const
).map((value) => ({ id: value, value, label: EMPLOYMENT_TYPE_LABEL[value] }));

/** "Workplace" (Figma 1:789). */
export const REMOTE_OPTIONS: readonly FilterOption<RemoteType>[] = (
  ['remote', 'hybrid', 'onsite'] as const
).map((value) => ({ id: value, value, label: REMOTE_TYPE_LABEL[value] }));

/** "Experience level" (Figma 1:806). "Any" clears the group rather than being a level of its own. */
export const EXPERIENCE_OPTIONS: readonly FilterOption<ExperienceLevel | undefined>[] = [
  { id: 'any', value: undefined, label: 'Any' },
  ...(['entry', 'mid', 'senior', 'lead'] as const).map((value) => ({
    id: value,
    value,
    label: EXPERIENCE_LEVEL_LABEL[value],
  })),
];

/**
 * "Sort by" (Figma 1:819). A deliberate subset of `JobSort` — the sheet offers the two the
 * artboard draws, while the inline sort control on Discover keeps `salary` as a third option.
 */
export const SORT_SEGMENTS: readonly Segment<JobSort>[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'recent', label: 'Date posted' },
];

/**
 * The sheet cannot render `salary`, and a SegmentedControl given a value outside its segments
 * seats the pill under the first tab with nothing marked selected. Fall back for display only —
 * the draft keeps the real sort, so Apply does not overwrite it.
 */
export const sheetSortValue = (sort: JobSort): JobSort => (sort === 'salary' ? 'relevance' : sort);

/** Ends and granularity of the salary slider (Figma 1:799–1:804), all in INR. */
export const SALARY_SCALE = {
  min: SALARY_FILTER_MIN,
  max: SALARY_FILTER_MAX,
  step: SALARY_FILTER_STEP,
  /** Keeps the thumbs a readable ₹5L apart so their labels never collide. */
  minDistance: 500_000,
} as const;
