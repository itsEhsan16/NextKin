import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

import { FLOW_ART } from './FlowHero';

// ATS 01 at 390 (645:3), in artboard units: each block is the box it stands in for.
const TITLE_H = 24 / 0.75; // 645:15
const TITLE_TO_LEDE = 8 / 0.75;
const LEDE_H = 18 / 0.75; // 645:16, one line
const HERO_TO_ROWS = 22 / 0.75;
const FILE_H = 67.5 / 0.75; // 645:22
const JOB_H = 79.5 / 0.75; // 645:31
const PASTE_H = 84.4 / 0.75; // 645:37
const ROW_GAP = 10 / 0.75;

/**
 * ATS 01's loading state, in the page's own shape — the drawing, the hero, the file and job rows
 * and the paste tile — so nothing jumps when the saved jobs and the plan land. Never a spinner;
 * the screen pins an inert bar under it, which owns the bottom inset.
 */
export function AtsCheckSkeleton() {
  const { s } = useTheme();
  const art = FLOW_ART.atsUpload;
  return (
    <View accessible accessibilityLabel="Loading the ATS check">
      <View style={{ alignItems: 'center' }}>
        <Skeleton
          width={s(art.w / 0.75)}
          height={s(art.h / 0.75)}
          radius="cardLg"
          style={{ marginBottom: s(art.toTitle / 0.75) }}
        />
        <Skeleton width="55%" height={s(TITLE_H)} />
        <Skeleton width="80%" height={s(LEDE_H)} style={{ marginTop: s(TITLE_TO_LEDE) }} />
      </View>
      <View style={{ marginTop: s(HERO_TO_ROWS), gap: s(ROW_GAP) }}>
        <Skeleton height={s(FILE_H)} radius="cardLg" />
        <Skeleton height={s(JOB_H)} radius="cardLg" />
        <Skeleton height={s(PASTE_H)} radius="cardLg" />
      </View>
    </View>
  );
}
