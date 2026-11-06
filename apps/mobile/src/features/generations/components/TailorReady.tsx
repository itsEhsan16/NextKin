import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { TailorRun } from '@/data/models';
import { StatusPill } from '@/features/create/flow/FlowKit';
// Deep import on purpose: the profile barrel drags its screens in.
import { GapInterviewCard } from '@/features/profile/components/GapInterviewCard';
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
  /** Opens the gap interview, when there's anything to ask (toreview §146.7). */
  onOpenQuestions: () => void;
  /** Another flow's pill beside "Saved to Resumes" (Build's band). */
  pill?: ReactNode;
  /** What sits at the end in place of the next-step note (Build's next steps). */
  next?: ReactNode;
  /** The page preview, drawn under the title. */
  preview?: ReactNode;
};

function ScoreRow({
  score,
  baseline,
  onSeeChanges,
}: {
  score?: number;
  baseline?: number;
  onSeeChanges: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  if (score == null) return null;
  const tenths = (n: number) => (Math.round(n) / 10).toFixed(1);
  return (
    <View style={[styles.scoreRow, { backgroundColor: colors.successSurface }]}>
      <View style={styles.flex}>
        <Text variant="footnote" color="success">
          ATS score
        </Text>
        <Text variant="title3" color="ink">
          {baseline != null && Math.round(baseline) !== Math.round(score)
            ? `${tenths(baseline)} → ${tenths(score)}`
            : tenths(score)}
        </Text>
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
  onOpenQuestions,
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
      <ScoreRow score={score} baseline={run?.baselineScore} onSeeChanges={onSeeChanges} />
      <GapInterviewCard onOpen={onOpenQuestions} />
      {next ?? <NextStepNote text={`Next: download it, then apply on ${where}`} />}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(16), paddingTop: u(4), width: '100%' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: u(8), flexWrap: 'wrap' },
  flex: { flex: 1 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(12),
    paddingHorizontal: u(14),
    paddingVertical: u(12),
    borderRadius: u(18),
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2) },
}));
