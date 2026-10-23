import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import CoverLetterIcon from '../../../../assets/icons/create/cover-letter.svg';
import GoodSparkle from '../../../../assets/icons/jobs/match-sparkle-good.svg';
import StrongSparkle from '../../../../assets/icons/jobs/match-sparkle-strong.svg';
import InterviewIcon from '../../../../assets/icons/shortcuts/interview-prep.svg';
import type { AtsBand } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { buildBand, buildBandLabel } from './buildRun';

// BUILD 06's pill at 390 (599:42), in artboard units — TAILOR 05's pill metrics.
const PILL_PAD_L = 9 / 0.75;
const PILL_PAD_R = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const SPARKLE_W = 12 / 0.75;
const SPARKLE_H = 11.7543 / 0.75;

// BUILD 06's next-step tiles at 390 (599:69 / 599:88 / 599:104).
const TILES_GAP = 10 / 0.75;
const TILE_PAD_X = 12 / 0.75;
const TILE_PAD_Y = 11 / 0.75;
const TILE_GAP = 10 / 0.75;
const TILE_RADIUS = 14 / 0.75;
const TILE_BORDER = 0.75 / 0.75;
const COVER_W = 30 / 0.75;
const COVER_H = 29.5856 / 0.75;
const INTERVIEW_W = 27.9228 / 0.75;
const INTERVIEW_H = 28.0001 / 0.75;

const BAND_LOOK: Record<AtsBand, { bg: ColorToken; fg: ColorToken }> = {
  strong: { bg: 'successSurface', fg: 'success' },
  good: { bg: 'warningSurface', fg: 'warningStrong' },
  fair: { bg: 'surfaceSubtle', fg: 'textSecondary' },
  weak: { bg: 'surfaceSubtle', fg: 'textSecondary' },
};

/** The job cards' sparkles, one per band that has been drawn; lower bands get none. */
const BAND_SPARKLE: Partial<Record<AtsBand, (props: SvgProps) => ReactElement>> = {
  strong: (p) => <StrongSparkle {...p} />,
  good: (p) => <GoodSparkle {...p} />,
};

/** "✦ Strong match" — the band of the built resume's score (599:42). Waits for the score. */
export function BuildBandPill({ score }: { score?: number }) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  if (score == null) return null;
  const band = buildBand(score);
  const look = BAND_LOOK[band];
  return (
    <View style={[styles.pill, { borderRadius: radii.full, backgroundColor: colors[look.bg] }]}>
      {BAND_SPARKLE[band]?.({ width: s(SPARKLE_W), height: s(SPARKLE_H) })}
      <Text variant="microBadge" color={look.fg}>
        {buildBandLabel(band)}
      </Text>
    </View>
  );
}

type TileProps = {
  label: string;
  hint: string;
  icon: ReactElement;
  onPress: () => void;
};

function NextTile({ label, hint, icon, onPress }: TileProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(label, hint)}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[
        styles.tile,
        { backgroundColor: colors.brandSurface, borderColor: colors.brandBorder },
      ]}
    >
      {icon}
      <Text variant="captionSemiBold" style={styles.tileText}>
        {label}
      </Text>
    </Pressable>
  );
}

export type BuildNextTilesProps = {
  /** Absent for a job pasted or uploaded from Home: a letter needs a NextKin job. */
  onCoverLetter?: () => void;
  onInterview: () => void;
};

/**
 * BUILD 06's two next steps (599:69). A build from Home has no job page in context, so the
 * letter and the practice set are offered here, each about the resume just built.
 */
export function BuildNextTiles({ onCoverLetter, onInterview }: BuildNextTilesProps) {
  const { s } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tiles}>
      {onCoverLetter ? (
        <NextTile
          label="Cover letter for this job"
          hint="Sets up a cover letter from this resume"
          icon={<CoverLetterIcon width={s(COVER_W)} height={s(COVER_H)} />}
          onPress={onCoverLetter}
        />
      ) : null}
      <NextTile
        label="Practice the interview"
        hint="Sets up interview questions from this resume"
        icon={<InterviewIcon width={s(INTERVIEW_W)} height={s(INTERVIEW_H)} />}
        onPress={onInterview}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_L),
    paddingRight: s(PILL_PAD_R),
    paddingVertical: s(PILL_PAD_Y),
  },
  tiles: { flexDirection: 'row', alignItems: 'stretch', gap: s(TILES_GAP) },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(TILE_GAP),
    paddingHorizontal: s(TILE_PAD_X),
    paddingVertical: s(TILE_PAD_Y),
    borderRadius: s(TILE_RADIUS),
    borderWidth: s(TILE_BORDER),
  },
  tileText: { flex: 1 },
}));
