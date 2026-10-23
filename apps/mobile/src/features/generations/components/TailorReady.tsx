import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { tailorChanges, type TailorChange, type TailorRun } from '@/data/models';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { NextStepNote } from './NextStepNote';
import { TailorCheckRow } from './TailorCheckRow';

export type TailorReadyProps = {
  /** A tailoring run's record; it supplies the "Up from" pill and the changes when they are not passed. */
  run?: TailorRun;
  company?: string;
  /** "stripe.com" — where the next-step note says to apply. */
  domain?: string;
  /** The tailored resume's score, once it has loaded. */
  score?: number;
  onSeeAll: () => void;
  /**
   * Another flow's parts on the same layout (BUILD 06 599:27): the pill beside "Saved to
   * Resumes", the change rows, and what sits under the card in place of the next-step note.
   */
  pill?: ReactNode;
  changes?: readonly TailorChange[];
  next?: ReactNode;
};

// TAILOR 05 at 390 (608:300 → 609:3), in artboard units.
const TITLE_TO_LINE = 6 / 0.75;
const LINE_GAP = 8 / 0.75;
const PILL_PAD_L = 9 / 0.75;
const PILL_PAD_R = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const PILL_GLYPH = 9.5 / 0.75;
const TEXT_TO_CARD = 18 / 0.75;
const CARD_PAD = 14 / 0.75;
const HEADER_PAD_B = 4 / 0.75;
const LINK_GAP = 4.5 / 0.75;
const LINK_GLYPH = 8 / 0.75;
const LINK_H = 16 / 0.75;
const CARD_TO_NOTE = 14 / 0.75;

/**
 * "Up from 72" is a claim, so it is made only when the score did go up. A run that landed level
 * or lower says what the score was instead, in grey.
 */
function ScorePill({ score, baseline }: { score?: number; baseline: number }) {
  const { colors, radii, s } = useTheme();
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
      {up ? (
        <FontAwesome5 name="arrow-up" size={s(PILL_GLYPH)} color={colors.success} solid />
      ) : null}
      <Text variant="microBadge" color={up ? 'success' : 'textSecondary'}>
        {up ? `Up from ${baseline}` : `Was ${baseline}`}
      </Text>
    </View>
  );
}

/** TAILOR 05 (608:267) under the preview: the title, the score line, what changed, what next. */
export function TailorReady({
  run,
  company,
  domain,
  score,
  onSeeAll,
  pill,
  changes,
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

      <Card radius="cardLg" style={styles.card}>
        <View style={styles.header}>
          <Text {...a11yHeader()} variant="titleSm" style={styles.headerTitle}>
            What changed for this job
          </Text>
          <Pressable
            {...a11yButton('See all changes', 'Opens the tailored resume')}
            feedback="subtle"
            hitSlop={hitSlopFor(s(LINK_H))}
            onPress={onSeeAll}
            style={styles.link}
          >
            <Text variant="viewAllLink" color="brand">
              See all
            </Text>
            <FontAwesome5 name="chevron-right" size={s(LINK_GLYPH)} color={colors.brand} solid />
          </Pressable>
        </View>
        {(changes ?? (run ? tailorChanges(run) : [])).map((change) => (
          <TailorCheckRow
            key={change.label}
            label={change.label}
            state={change.left ? 'left' : 'done'}
          />
        ))}
      </Card>

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
  card: { marginTop: s(TEXT_TO_CARD), padding: s(CARD_PAD) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(LINE_GAP),
    paddingBottom: s(HEADER_PAD_B),
  },
  headerTitle: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: s(LINK_GAP) },
  note: { marginTop: s(CARD_TO_NOTE) },
}));
