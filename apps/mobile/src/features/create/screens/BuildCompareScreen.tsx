import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { atsBandFor, compareProfileToJob } from '@/data/models';
import { useJdDraft, useJob, useJobJd, useProfile, useSubscription } from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { useCreateActions } from '../hooks/useCreateActions';
import { useBuildActions, useStartBuild } from '../hooks/useStartBuild';
import { BUILD_STEPS } from './BuildJobScreen';

export type BuildCompareScreenProps = {
  /** A saved job: read the way a build reads it. */
  jobId?: string;
  /** A job that was pasted or shared and already read; wins over `jobId`. */
  jdId?: string;
};

export const BUILD_MATCH_TITLE = 'How you match';
export const BUILD_CTA = 'Build resume';

/** One line per band, said plainly (§172). */
const VERDICT: Record<ReturnType<typeof atsBandFor>, string> = {
  strong: 'Strong match. A few touches left.',
  good: 'Good start. A few gaps to close.',
  fair: 'Fair match. Some gaps to close.',
  weak: 'Big gaps. Worth a careful look.',
};

/**
 * Build Resume, step 2 of 3 (toreview.md §172): the match ring and one verdict, the job's skills
 * as chips — the ones on your profile ticked, the missing ones off until you tap the ones you
 * really have — and what the build will improve, folded. Replaces BUILD 04, 04b and the 04c
 * sheet: the choices are made inline and "Build resume" is the first and only build button.
 */
export function BuildCompareScreen({ jobId, jdId }: BuildCompareScreenProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const actions = useBuildActions();
  const { openJobDetails } = useCreateActions();
  const build = useStartBuild();

  const read = useJdDraft(jdId ?? '');
  const forJob = useJobJd(jdId ? '' : (jobId ?? ''));
  const draft = jdId ? read : forJob;
  const job = useJob(jobId ?? '');
  const profile = useProfile();
  const subscription = useSubscription();

  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [improveOpen, setImproveOpen] = useState(false);
  const enter = useRevealStagger(!!draft.data && !!profile.data && !!subscription.data);

  const frame = (subtitle: string | undefined, body: React.ReactNode, footer?: React.ReactNode) => (
    <OnboardingFrame
      step={2}
      total={BUILD_STEPS}
      title={BUILD_MATCH_TITLE}
      subtitle={subtitle}
      onBack={actions.goBack}
      footer={footer}
    >
      {body}
    </OnboardingFrame>
  );

  const failed = draft.isError || profile.isError || subscription.isError;
  if (failed || (jdId == null && jobId == null)) {
    return frame(
      undefined,
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn’t compare"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          if (draft.isError) void draft.refetch();
          if (profile.isError) void profile.refetch();
          if (subscription.isError) void subscription.refetch();
        }}
      />,
    );
  }

  if (!draft.data || !profile.data || !subscription.data) {
    return frame(
      'Comparing your profile with the job…',
      <View
        style={styles.stack}
        accessible
        accessibilityLabel="Comparing your profile with this job"
      >
        <Skeleton height={120} radius="cardLg" />
        <Skeleton height={160} radius="cardLg" />
      </View>,
      <Button label={BUILD_CTA} size="xl" block disabled />,
    );
  }

  const jd = draft.data;
  const result = compareProfileToJob(jd, profile.data);
  const company = jd.company ?? job.data?.company ?? 'this company';
  const have = result.keywords.filter((keyword) => keyword.onResume);
  const missing = result.keywords.filter((keyword) => !keyword.onResume);
  const toFix = result.improvements.filter((item) => !item.ok);
  const linkedJobId = jd.jobId ?? jobId;
  const target = { jdId: jd.id, ...(linkedJobId ? { jobId: linkedJobId } : {}) };

  const toggle = (label: string) =>
    setAdded((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const start = () =>
    build.start({
      ...target,
      build: {
        added: missing.filter((k) => added.has(k.label)).map((k) => k.label),
        skipped: missing.filter((k) => !added.has(k.label)).map((k) => k.label),
      },
    });

  const footer = (
    <View style={styles.footer}>
      {build.quotaSpent ? (
        <Button
          label="See Pro plans"
          size="xl"
          block
          onPress={() => actions.openUpgrade('generations')}
        />
      ) : (
        <Button
          label={BUILD_CTA}
          size="xl"
          block
          loading={build.pending}
          leading={<SparkleIcon width={18} height={18} />}
          onPress={start}
        />
      )}
      {build.error || build.quotaNote ? (
        <Text
          variant="footnote"
          color={build.error ? 'danger' : 'textTertiary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {build.error ?? build.quotaNote}
        </Text>
      ) : null}
    </View>
  );

  return frame(
    `${jd.title} · ${company}`,
    <View style={styles.stack}>
      <Animated.View
        entering={enter(0)}
        style={[styles.card, styles.summary, { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft }]}
      >
        <ScoreRing
          score={result.score}
          size={72}
          strokeWidth={7}
          label="match"
          numberVariant="title2"
          accessibilityLabel={`Match ${Math.round(result.score)} out of 100`}
        />
        <View style={styles.fill}>
          <Text variant="title3" color="ink">
            {VERDICT[atsBandFor(result.score)]}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View the job"
            feedback="subtle"
            onPress={() => openJobDetails(jd.id)}
            style={styles.link}
          >
            <Text variant="footnote" color="brand">
              View the job
            </Text>
            <Icon name="ChevronRight" size="xs" color={colors.brand} />
          </Pressable>
        </View>
      </Animated.View>

      {result.keywords.length > 0 ? (
        <Animated.View entering={enter(1)}>
          <Text variant="title3" color="ink">
            Skills it asks for
          </Text>
          <Text variant="callout" color="textSecondary" style={styles.hint}>
            {missing.length > 0
              ? 'Tap the missing ones you really have.'
              : 'Your profile has every one.'}
          </Text>
          <View style={styles.chips}>
            {missing.map((keyword) => (
              <ChoiceChip
                key={keyword.label}
                label={keyword.label}
                selected={added.has(keyword.label)}
                onPress={() => toggle(keyword.label)}
              />
            ))}
            {have.map((keyword) => (
              <ChoiceChip key={keyword.label} label={keyword.label} selected locked />
            ))}
          </View>
          {added.size > 0 ? (
            <Text variant="footnote" color="textTertiary" style={styles.hint}>
              Added skills go on your profile too.
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {toFix.length > 0 ? (
        <Animated.View entering={enter(2)}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: improveOpen }}
            accessibilityLabel={`What we’ll improve, ${toFix.length}`}
            feedback="subtle"
            onPress={() => setImproveOpen((open) => !open)}
            style={[styles.card, styles.improveHead, { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft }]}
          >
            <Icon name="Stars02" size="md" color={colors.brand} />
            <Text variant="bodyLgStrong" color="ink" style={styles.fill}>
              What we’ll improve ({toFix.length})
            </Text>
            <Icon name={improveOpen ? 'ChevronUp' : 'ChevronDown'} size="sm" color={colors.iconDefault} />
          </Pressable>
          {improveOpen ? (
            <View style={styles.improveList}>
              {toFix.map((item) => (
                <View key={item.key} style={styles.improveRow}>
                  <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                  <View style={styles.fill}>
                    <Text variant="bodyLgStrong" color="ink">
                      {item.label}
                    </Text>
                    <Text variant="callout" color="textSecondary">
                      {item.detail}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>,
    footer,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  stack: { gap: u(24) },
  fill: { flex: 1 },
  card: { borderRadius: u(24), borderWidth: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: u(16), padding: u(16) },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2), marginTop: u(6) },
  hint: { marginTop: u(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(14) },
  improveHead: { flexDirection: 'row', alignItems: 'center', gap: u(12), padding: u(16) },
  improveList: { gap: u(14), paddingHorizontal: u(8), paddingTop: u(14) },
  improveRow: { flexDirection: 'row', gap: u(12) },
  dot: { width: u(6), height: u(6), borderRadius: u(3), marginTop: u(8) },
  footer: { gap: u(8) },
}));
