import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Job } from '@/data/models';
import { useJob, useJobFit, useSimilarJobs } from '@/data/queries';
import { TailorResumeSheet } from '@/features/create/components/TailorResumeSheet';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { JobAboutSection } from '../components/JobAboutSection';
import { JobCompanyCard } from '../components/JobCompanyCard';
import { JobsToastHost } from '../JobsToastHost';
import { JobDetailActions } from '../components/JobDetailActions';
import { JobDetailHero } from '../components/JobDetailHero';
import { FitLabels } from '../components/FitLabels';
import { JobMatchCard } from '../components/JobMatchCard';
import { SimilarJobCard } from '../components/SimilarJobCard';
import { TailorResumeCta } from '../components/TailorResumeCta';
import { useApplyFlow } from '../hooks/useApplyFlow';
import { useJobsActions } from '../hooks/useJobsActions';
import { useSaveJob } from '../hooks/useSaveJob';

export type JobDetailScreenProps = { id: string };

/**
 * JOBS 05 — Job Detail (Figma 1:830, redrawn as 443:2: hero, match card, tailor row and company
 * card; the rest of the page is as it was).
 *
 * The header actions scroll with the page, as drawn: only node 1:923 is marked sticky. Back stays
 * reachable through the platform gesture and the Android hardware button once it scrolls away.
 */
export function JobDetailScreen({ id }: JobDetailScreenProps) {
  const { colors, spacing, s } = useTheme();
  const insets = useSafeAreaInsets();
  const actions = useJobsActions();

  // Opened from a list, the page paints at once from the list's copy while the detail loads.
  const job = useJob(id, { seedFromLists: true });
  const fit = useJobFit(job.data);
  const similar = useSimilarJobs(id);
  const save = useSaveJob();
  // NextKin submits nothing: Apply opens the employer's page, then asks "Did you apply?".
  const applyFlow = useApplyFlow(job.data);
  // TAILOR 01 (606:2): the Tailor row asks which resume first, over the page, then moves on.
  const [tailorOpen, setTailorOpen] = useState(false);

  const body = (children: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: colors.surfacePage, paddingTop: insets.top }]}>
      {children}
    </View>
  );

  // Loading and error keep the way back: every other pushed screen holds its header in all
  // states, and the gesture alone is not discoverable.
  const backRow = (
    <View
      style={[
        styles.headerRow,
        { paddingHorizontal: spacing.gutter, paddingTop: spacing.headerTopPushed },
      ]}
    >
      <IconButton icon="ChevronLeft" label="Back" onPress={actions.goBack} />
    </View>
  );

  if (job.isPending) {
    return body(
      <>
        {backRow}
        <View style={{ padding: spacing.gutter, gap: spacing[4] }}>
          <Skeleton width={s(64)} height={s(64)} radius="xxl" />
          <Skeleton width="80%" height={s(34)} />
          <Skeleton width="60%" height={s(22)} />
          <Skeleton height={s(294)} radius="cardLg" style={{ marginTop: spacing[4] }} />
          <Skeleton height={s(84)} radius="card" />
        </View>
      </>,
    );
  }

  // Data-first: a failed background refresh keeps the job on screen.
  if (!job.data) {
    return body(
      <>
        {backRow}
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn't load this job"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void job.refetch()}
        />
      </>,
    );
  }

  const current: Job = job.data;

  return body(
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.headerTopPushed,
          paddingBottom: spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <IconButton icon="ChevronLeft" label="Back" onPress={actions.goBack} />
          <View style={[styles.headerRight, { gap: spacing[3] }]}>
            <IconButton
              icon="Share07"
              label="Share this job"
              onPress={() => actions.shareJob(current)}
            />
            <IconButton
              icon="Bookmark"
              iconFilled={current.isSaved}
              label={current.isSaved ? 'Remove from saved' : 'Save job'}
              onPress={() => save.toggle(current)}
            />
          </View>
        </View>

        <JobDetailHero job={current} />

        {current.matchBand && current.matchCriteria?.length ? (
          <JobMatchCard
            band={current.matchBand}
            criteria={current.matchCriteria}
            {...(current.matchBasis ? { basis: current.matchBasis } : {})}
            onSeeFullCriteria={() => actions.openFullCriteria(current)}
          />
        ) : null}

        <FitLabels labels={fit} />

        <TailorResumeCta onPress={() => setTailorOpen(true)} />

        <JobAboutSection
          description={current.description}
          responsibilities={current.responsibilities}
          requirements={current.requirements}
        />

        <View style={{ gap: spacing[4] }}>
          <Text variant="section" accessibilityRole="header">
            {`About ${current.company}`}
          </Text>
          <JobCompanyCard job={current} onPress={actions.openCompany} />
        </View>

        <View style={{ gap: spacing[4] }}>
          <SectionHeader
            title="Similar jobs"
            variant="section"
            actionLabel="View all"
            onAction={actions.viewAllJobs}
          />
          {similar.isPending ? (
            <View style={{ gap: spacing[3] }}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} height={s(88)} radius="card" />
              ))}
            </View>
          ) : similar.data?.length ? (
            <View style={{ gap: spacing[3] }}>
              {similar.data.map((item) => (
                <SimilarJobCard key={item.id} job={item} onPress={actions.openJob} />
              ))}
            </View>
          ) : (
            <StateView
              compact
              icon="Briefcase01"
              title="No similar jobs yet"
              message="We'll surface related roles as more come in."
            />
          )}
        </View>
      </ScrollView>

      <JobDetailActions
        saved={current.isSaved}
        onToggleSave={() => save.toggle(current)}
        onApply={applyFlow.apply}
      />

      <TailorResumeSheet
        open={tailorOpen}
        job={current}
        onClose={() => setTailorOpen(false)}
        onCompare={(resumeId) => {
          setTailorOpen(false);
          actions.openTailorCompare(current.id, resumeId);
        }}
        onStartFromNothing={() => {
          setTailorOpen(false);
          actions.openZeroResume(current.id);
        }}
      />

      {/*
        The share fallback's toast. Share has no screen and no visible result of its own, so
        without this a share on a device with no OS sheet is a completely silent tap — which is
        what it was until now: the host shipped in 9H and was mounted nowhere.
      */}
      <JobsToastHost />
    </>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
