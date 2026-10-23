import type { InsightKind, InsightsRange } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import {
  ProfileGoalsIllustration,
  ProfileInsightsIllustration,
  ProfileTermsIllustration,
  SettingsLightbulbIllustration,
} from '@/ui/illustrations';

export const RANGES: readonly InsightsRange[] = ['7d', '30d', '90d'];

/** The line under each stat (461:111): "vs previous 30 days". */
export const PREVIOUS_LABEL: Record<InsightsRange, string> = {
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '90d': 'vs previous 90 days',
};

/** The chart tooltip's caption (462:28) for the window's total. */
export const TOTAL_CAPTION: Record<InsightsRange, string> = {
  '7d': 'Jobs analyzed this week',
  '30d': 'Jobs analyzed this month',
  '90d': 'Jobs analyzed this quarter',
};

/** Each AI insight's glyph (462:64-113), by what the insight is about. */
export const INSIGHT_ART: Record<InsightKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  match: ProfileInsightsIllustration,
  title: ProfileTermsIllustration,
  skills: SettingsLightbulbIllustration,
  pace: ProfileGoalsIllustration,
};

/** The chart's ceiling: the next ten above the highest point, so the top gridline is a round 30. */
export const chartCeiling = (max: number): number => Math.max(10, Math.ceil(max / 10) * 10);

/**
 * A smooth path through the points (462:23), as a monotone cubic so the curve never overshoots a
 * plateau into a dip the data doesn't have.
 */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return '';
  const first = points[0]!;
  if (n === 1) return `M${first.x},${first.y}`;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    slopes.push((b.y - a.y) / (b.x - a.x));
  }
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const before = slopes[i - 1]!;
    const after = slopes[i]!;
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const third = (b.x - a.x) / 3;
    d += ` C${a.x + third},${a.y + tangents[i]! * third} ${b.x - third},${b.y - tangents[i + 1]! * third} ${b.x},${b.y}`;
  }
  return d;
}
