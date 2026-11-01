import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { TailorRun } from '@/data/models';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { NextStepNote } from './NextStepNote';
import { Icon } from '@/ui/Icon';

export type TailorReadyProps = {
  /** A tailoring run's record; it supplies the "Up from" pill. */
  run?: TailorRun;
  company?: string;
  /** "stripe.com" — where the next-step note says to apply. */
  domain?: string;
  /** The tailored resume's score, once it has loaded. */
  score?: number;
  /** Opens the Versions page, where every change sits with its reason (toreview §146.5). */
  onSeeChanges: () => void;
  /**
   * Another flow's parts on the same layout (BUILD 06 599:27): the pill beside "Saved to
   * Resumes", and what sits under the link in place of the next-step note.
   */
  pill?: ReactNode;
  next?: ReactNode;
};

// TAILOR 05 at 390 (608:300 → 609:3), in artboard units.
const TITLE_TO_LINE = 6 / 0.75;
const LINE_GAP = 8 / 0.75;
const PILL_PAD_L = 9 / 0.75;
const PILL_PAD_R = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const TEXT_TO_LINK = 18 / 0.75;
const LINK_GAP = 4.5 / 0.75;
const LINK_H = 16 / 0.75;
const LINK_TO_NOTE = 14 / 0.75;

/**
 * "Up from 72" is a claim, so it is made only when the score did go up. A run that landed level
 * or lower says what the score was instead, in grey.
 */
function ScorePill({ score, baseline }: { score?: number; baseline: number }) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  if (score == null) return null;
  const up = score > baseline;
  return (
    <View
      style={[
        styles.pill,
        {
          borderRadius: radii.full,
          backgroundColor: up ? colors.successSurface : colors.surfaceSubtle,
        },
      ]}
    >
      {up ? <Icon name="ArrowUp" size="sm" color={colors.success} /> : null}
      <Text variant="microBadge" color={up ? 'success' : 'textSecondary'}>
        {up ? `Up from ${baseline}` : `Was ${baseline}`}
      </Text>
    </View>
  );
}

/**
 * TAILOR 05 (608:267) under the preview: the title, the score line, the way to what changed, and
 * what next. The board's list of changes moved to the Versions page (owner, toreview §146.5).
 */
export function TailorReady({
  run,
  company,
  domain,
  score,
  onSeeChanges,
  pill,
  next,
}: TailorReadyProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const title = company ? `Your resume for ${company} is ready` : 'Your resume is ready';
  const where = domain ?? "the employer's site";

  return (
    <View>
      <Text {...a11yHeader()} variant="headlineLg" align="center">
        {title}
      </Text>
      <View style={styles.line}>
        {pill ?? (run ? <ScorePill score={score} baseline={run.baselineScore} /> : null)}
        <Text variant="caption" color="textSecondary">
          Saved to Resumes
        </Text>
      </View>

      <Pressable
        {...a11yButton('See what changed', 'Opens this resume’s versions')}
        feedback="subtle"
        hitSlop={hitSlopFor(s(LINK_H))}
        onPress={onSeeChanges}
        style={styles.link}
      >
        <Text variant="viewAllLink" color="brand">
          See what changed
        </Text>
        <Icon name="ChevronRight" size="sm" color={colors.brand} />
      </Pressable>

      {next ? (
        <View style={styles.note}>{next}</View>
      ) : (
        <NextStepNote text={`Next: download it, then apply on ${where}`} style={styles.note} />
      )}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  line: {
    marginTop: s(TITLE_TO_LINE),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(LINE_GAP),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_L),
    paddingRight: s(PILL_PAD_R),
    paddingVertical: s(PILL_PAD_Y),
  },
  link: {
    marginTop: s(TEXT_TO_LINK),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(LINK_GAP),
  },
  note: { marginTop: s(LINK_TO_NOTE) },
}));
