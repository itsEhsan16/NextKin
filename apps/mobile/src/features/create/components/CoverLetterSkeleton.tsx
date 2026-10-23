import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

import { FLOW_ART } from './FlowHero';

// COVER 01 at 390 (644:2), in artboard units: each block is the box it stands in for.
const TITLE_H = 24 / 0.75; // 644:30
const TITLE_TO_LEDE = 8 / 0.75;
const LEDE_H = 35 / 0.75; // 644:31, two lines
const HERO_TO_SECTION = 22 / 0.75;
const LABEL_H = 21 / 0.75; // 644:33
const LABEL_TO_ROW = 10 / 0.75;
const PICK_H = 62.5 / 0.75; // 644:36
const ROW_TO_SECTION = 18 / 0.75;
const TONE_H = 57.5 / 0.75; // 644:56
const TONE_GAP = 8 / 0.75;
const TONES = 4;

/**
 * The cover-letter setup's loading state, in the shape of COVER 01 under the stepper — the
 * drawing, the hero, the job and resume rows and the four tones — so nothing jumps when the
 * queries land. Never a spinner. The screen pins an inert bar under it for the same reason: the
 * bar owns the bottom inset, so a loading page without one would resize the viewport the moment
 * the data settles.
 */
export function CoverLetterSkeleton() {
  const { s } = useTheme();
  const art = FLOW_ART.coverSetup;

  const section = (rows: number, rowH: number, gap = 0) => (
    <View style={{ marginTop: s(ROW_TO_SECTION) }}>
      <Skeleton width="25%" height={s(LABEL_H)} />
      <View style={{ marginTop: s(LABEL_TO_ROW), gap: s(gap) }}>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} height={s(rowH)} radius="card" />
        ))}
      </View>
    </View>
  );

  return (
    <View accessible accessibilityLabel="Loading cover letter setup">
      <View style={{ alignItems: 'center' }}>
        <Skeleton
          width={s(art.w / 0.75)}
          height={s(art.h / 0.75)}
          radius="cardLg"
          style={{ marginBottom: s(art.toTitle / 0.75) }}
        />
        <Skeleton width="60%" height={s(TITLE_H)} />
        <Skeleton width="85%" height={s(LEDE_H)} style={{ marginTop: s(TITLE_TO_LEDE) }} />
      </View>
      <View style={{ marginTop: s(HERO_TO_SECTION - ROW_TO_SECTION) }}>
        {section(1, PICK_H)}
        {section(1, PICK_H)}
        {section(TONES, TONE_H, TONE_GAP)}
      </View>
    </View>
  );
}
