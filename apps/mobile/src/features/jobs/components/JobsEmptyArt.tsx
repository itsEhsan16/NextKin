import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import AppliedArt from '../../../../assets/illustrations/jobs/empty-applied.svg';
import DiscoverArt from '../../../../assets/illustrations/jobs/empty-discover.svg';
import SavedArt from '../../../../assets/illustrations/jobs/empty-saved.svg';
import { useTheme } from '@/theme';

import type { JobsSegment } from '../jobsStore';

/**
 * Each tab's empty-state drawing (Figma 395:1079 / 395:1212 / 395:1263), replacing the grey icon
 * tile the three boards used to draw. `w`/`h` are the drawn boxes over 0.75 — they differ because
 * the three drawings do, and none is stretched to match the others.
 */
const ART: Record<JobsSegment, { Art: FC<SvgProps>; w: number; h: number }> = {
  // 282.75 × 216.213 drawn — the searcher at a laptop, among filters.
  discover: { Art: DiscoverArt, w: 377, h: 288.284 },
  // 282.34 × 188.25 drawn — a bookmarked listing.
  saved: { Art: SavedArt, w: 376.4533, h: 251 },
  // 282 × 230.027 drawn — an application flying off.
  applied: { Art: AppliedArt, w: 376, h: 306.7027 },
};

export function JobsEmptyArt({ segment }: { segment: JobsSegment }) {
  const { s } = useTheme();
  const { Art, w, h } = ART[segment];
  return <Art width={s(w)} height={s(h)} />;
}
