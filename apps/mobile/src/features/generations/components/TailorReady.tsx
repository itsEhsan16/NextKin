import type { ReactNode } from 'react';
import { View } from 'react-native';

import { atsBandFor, nextStepsLine, type TailorRun } from '@/data/models';
import { StatusPill } from '@/features/create/flow/FlowKit';
// Deep import on purpose: the profile barrel drags its screens in.
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { NextStepNote } from './NextStepNote';

export type TailorReadyProps = {
  /** A tailoring run's record; it supplies the score the resume started from. */
  run?: TailorRun;
  company?: string;
  /** "stripe.com" — where the next-step note says to apply. */
  domain?: string;
  /** The finished resume's score, once it has loaded. */
  score?: number;
  /** Opens the Versions page, where every change sits with its reason (toreview §146.5). */
  onSeeChanges: () => void;
  /** Another flow's pill beside "Saved to Resumes" (Build's band). */
  pill?: ReactNode;
  /** What sits at the end in place of the next-step note (Build's next steps). */
  next?: ReactNode;
  /** The page preview, drawn under the title. */
  preview?: ReactNode;
};

const BAND_LABEL = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
  weak: 'Weak match',
} as const;

/**
 * The score once the run is done, as the web's ScoreSummaryCard says it (owner, 2026-11-18,
 * toreview §235): the band, the move from where it started, how many of the job's key keywords
 * the page shows, a plan the run fell short of, and one next step. Every number is the run's own.
 */
function ScoreRow({
  score,
  run,
  onSeeChanges,
}: {
  score?: number;
  run?: TailorRun;
  onSeeChanges: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  if (score == null) return null;
  const tenths = (n: number) => (Math.round(n) / 10).toFixed(1);
  const baseline = run?.baselineScore;
  const projected = run?.projected;
  const match = run?.jobMatch;
  const moved = baseline != null && Math.round(baseline) !== Math.round(score);
  const facts = [
    match ? `${match.matched} of ${match.total} key keywords` : null,
    // A point of rounding either way is the same promise kept; a miss is said, briefly.
    projected != null && score < projected - 1 ? `Plan aimed for ${tenths(projected)}` : null,
  ].filter((x): x is string => x !== null);
  const missing = match?.missing ?? [];
  const tip =
    nextStepsLine(run?.next) ??
    (!match
      ? null
      : missing.length === 0
        ? 'All key keywords are in. Add results to stand out.'
        : `Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3}` : ''}. Add only what’s true.`);
  return (
    <View style={[styles.scoreCard, { backgroundColor: colors.successSurface }]}>
      <View style={styles.scoreRow}>
        <View style={styles.flex}>
          <Text variant="footnote" color="success">
            {`ATS score · ${BAND_LABEL[atsBandFor(score)]}`}
          </Text>
          <Text variant="title3" color="ink">
            {moved ? `${tenths(baseline!)} → ${tenths(score)}` : tenths(score)}
          </Text>
          {facts.length > 0 ? (
            <Text variant="footnote" color="textSecondary">
              {facts.join(' · ')}
            </Text>
          ) : null}
        </View>
        <Pressable
          {...a11yButton('See what changed', 'Opens this resume’s versions')}
          feedback="subtle"
          onPress={onSeeChanges}
          style={styles.link}
        >
          <Text variant="footnote" color="brand">
            See what changed
          </Text>
          <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
        </Pressable>
      </View>
      {tip ? (
        <Text variant="footnote" color="textSecondary">
          {tip}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A finished resume (toreview §173, Figma "Build · 3 Ready"): "Saved to Resumes", the title, the
 * page preview, the score and what changed, then what to do next. Tailor and Build share it.
 */
export function TailorReady({
  run,
  company,
  domain,
  score,
  onSeeChanges,
  pill,
  next,
  preview,
}: TailorReadyProps) {
  const styles = useStyles();
  const title = company ? `Your resume for ${company} is ready` : 'Your resume is ready';
  const where = domain ?? "the employer's site";

  return (
    <View style={styles.wrap}>
      <View style={styles.pills}>
        <StatusPill label="Saved to Resumes" icon="Check" />
        {pill}
      </View>
      <Text {...a11yHeader()} variant="title1" color="ink">
        {title}
      </Text>
      {preview}
      <ScoreRow score={score} run={run} onSeeChanges={onSeeChanges} />
      {next ?? <NextStepNote text={`Next: download it, then apply on ${where}`} />}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(16), paddingTop: u(4), width: '100%' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: u(8), flexWrap: 'wrap' },
  flex: { flex: 1 },
  scoreCard: { gap: u(8), paddingHorizontal: u(14), paddingVertical: u(12), borderRadius: u(18) },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2) },
}));
