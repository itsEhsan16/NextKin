import { View } from 'react-native';

import { atsQuickWins } from '@/data/models';
import { useResume, useResumeScore } from '@/data/queries';
import { pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { FlowFooter } from '@/ui/kit';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { SCORE_HERO_LINK, SCORE_HERO_RING, ScoreHero } from '../components/ScoreHero';
import { ScoreNotMeasured } from '../components/ScoreNotMeasured';
import { ScoreParts } from '../components/ScoreParts';
import { ScoreSection } from '../components/ScoreSection';
import { useResumesActions } from '../hooks/useResumesActions';

export type ResumeScoreScreenProps = { id: string };

/**
 * RESUMES 04, the ATS score (redesigned §177, after the ATS Check result): the hero card with the
 * ring, band and required-skills count, the rubric and assistant pills, where the points go, what
 * the score does not measure, then each section's checks in its own card. "Fix N quick wins" is
 * the pinned footer while any check can be fixed. Every number is the engine's (§7.8).
 */
export function ResumeScoreScreen({ id }: ResumeScoreScreenProps) {
  const { colors, spacing, u } = useTheme();
  const styles = useStyles();
  const actions = useResumesActions();

  const resume = useResume(id);
  const score = useResumeScore(id);
  const enter = useRevealStagger(!(resume.isPending || score.isPending), 'row');

  const quickWins = score.data ? atsQuickWins(score.data).length : 0;
  const page = (children: React.ReactNode, footer?: React.ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="ATS score" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[3] }}
      contentContainerStyle={{ paddingTop: spacing[3], paddingBottom: spacing[8] }}
      footer={footer}
    >
      {children}
    </Screen>
  );

  if (resume.isPending || score.isPending) {
    return page(
      <View style={styles.stack}>
        <Skeleton height={u(SCORE_HERO_RING + 80)} radius="card" />
        <View style={styles.row}>
          <Skeleton width={u(140)} height={u(SCORE_HERO_LINK)} radius="full" />
          <Skeleton width={u(120)} height={u(SCORE_HERO_LINK)} radius="full" />
        </View>
        <Skeleton height={u(220)} radius="card" />
        <Skeleton height={u(140)} radius="card" />
      </View>,
    );
  }

  if (resume.isError || score.isError || !resume.data || !score.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this score"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void resume.refetch();
          void score.refetch();
        }}
      />,
    );
  }

  const current = score.data;
  const { report } = current;
  const label = `Fix ${pluralize(quickWins, 'quick win')}`;

  return page(
    <View style={styles.stack}>
      <ScoreHero
        id={id}
        score={current}
        resume={resume.data}
        onRubric={() => actions.openScoreRubric(id)}
        onAsk={() => actions.askAboutScore(id)}
      />

      {report ? <ScoreParts parts={report.components} /> : null}

      {current.sections.map((section, index) => (
        <ScoreSection
          key={section.key}
          section={section}
          staggerBase={index * 2}
          enter={enter}
          onFix={(item) => actions.fixWithAi(id, item)}
        />
      ))}

      {report ? <ScoreNotMeasured lines={report.notMeasured} /> : null}

      <View style={styles.recalc}>
        <Icon name="RefreshCw01" size={u(16)} color={colors.iconMuted} />
        <Text variant="footnote" color="textSecondary" style={styles.flex}>
          Green checks appear the moment a fix lands — no re-scan needed.
        </Text>
      </View>
    </View>,
    quickWins > 0 ? (
      <FlowFooter
        inset
        primary={{ label, icon: 'Stars02', onPress: () => actions.fixWithAi(id) }}
      />
    ) : undefined,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  stack: { gap: u(24) },
  row: { flexDirection: 'row', gap: u(10) },
  recalc: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  flex: { flex: 1 },
}));
