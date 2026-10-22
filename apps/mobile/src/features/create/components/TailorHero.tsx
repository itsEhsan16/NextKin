import { View } from 'react-native';

import {
  ATS_BAND_LABEL,
  atsBandFor,
  buildHeadline,
  SCORE_LABEL,
  SCORE_LABEL_CAPS,
  tailorHeadline,
} from '@/data/models';
// Deep import on purpose: the resumes barrel drags its screens in. docMeta is pure formatting.
import { atsScoreColor } from '@/features/resumes/docMeta';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pill } from '@/ui/Pill';
import { ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type TailorHeroProps = {
  score: number;
  company: string;
  /**
   * 'tailor' rings the resume's ATS score against the job (TAILOR 02); 'build' rings how much of
   * the job the profile covers, as JOB MATCH, since there is no resume yet to score (BUILD 04b).
   */
  variant?: 'tailor' | 'build';
  /**
   * The Customize screen's way of saying it (toreview §114): out of 10 with one decimal ("5.9"),
   * with the band named beside the headline.
   */
  outOfTen?: boolean;
  /** False when the job description gave the engine nothing to score (D-15): no number at all. */
  scored?: boolean;
};

/** "5.9": the 0–100 score said out of 10, one decimal (toreview §114). */
export const scoreOutOfTen = (score: number): string => (Math.round(score) / 10).toFixed(1);

const UNSCORED = {
  title: 'Let’s aim it\nat this job',
  lede: 'This job description gave us too little to score against. You can still tailor to it.',
};

const RING_LABEL = {
  tailor: { caps: SCORE_LABEL_CAPS, spoken: SCORE_LABEL },
  build: { caps: 'JOB MATCH', spoken: 'Job match' },
} as const;

// TAILOR 02 hero at 390 (607:25), in artboard units.
const GAP = 14 / 0.75;
const TEXT_GAP = 6 / 0.75;
const RING = 86 / 0.75;
const RING_STROKE = 6.45 / 0.75;

/**
 * "A good start. Let's make it stronger" beside the ATS score against THIS job (TAILOR 02), or the
 * profile's job match (BUILD 04b). The headline and lede come from `tailorHeadline` /
 * `buildHeadline`, so the copy follows the score's band rather than flattering it, and the ring
 * takes the band's colour (amber for "good").
 */
export function TailorHero({
  score,
  company,
  variant = 'tailor',
  outOfTen = false,
  scored = true,
}: TailorHeroProps) {
  const { s } = useTheme();
  const styles = useStyles();
  const headline = variant === 'build' ? buildHeadline(score) : tailorHeadline(score);
  const title = scored ? headline.title : UNSCORED.title;
  const lede = scored ? headline.lede(company) : UNSCORED.lede;
  const ring = RING_LABEL[variant];
  const band = atsBandFor(score);
  const tenths = scoreOutOfTen(score);
  const spoken = !scored
    ? `No ${ring.spoken} for this job`
    : outOfTen
      ? `${ring.spoken} ${tenths} out of 10, ${ATS_BAND_LABEL[band]}, for this job`
      : `${ring.spoken} ${score} for this job`;

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {outOfTen && scored ? (
          <Pill
            label={`${SCORE_LABEL} · ${ATS_BAND_LABEL[band]}`}
            tone={band === 'strong' ? 'success' : 'warning'}
            style={styles.band}
          />
        ) : null}
        <Text {...a11yHeader(title.replace('\n', ' '))} variant="headlineLg">
          {title}
        </Text>
        <Text variant="captionRegular" color="textSecondary">
          {lede}
        </Text>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={spoken}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ScoreRing
            score={scored ? score : 0}
            label={outOfTen ? 'OUT OF 10' : ring.caps}
            valueText={!scored ? '–' : outOfTen ? tenths : undefined}
            size={s(RING)}
            strokeWidth={s(RING_STROKE)}
            ringColor={atsScoreColor(score)}
            trackColor="borderDefault"
            numberVariant="tailorRingValue"
            numberColor="textPrimary"
            labelVariant="microOverline"
            labelColor="textSecondary"
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  text: { flex: 1, gap: s(TEXT_GAP) },
  band: { alignSelf: 'flex-start' },
}));
