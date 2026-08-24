import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Job } from '@/data/models';
import { useJob, useSimilarJobs, useToggleSaveJob } from '@/data/queries';
import { PushPrimerHost, useApplyFlow } from '@/features/notifications';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { Toast } from '@/ui/Toast';

import { JobAboutSection } from '../components/JobAboutSection';
import { JobCompanyCard } from '../components/JobCompanyCard';
import { JobDetailActions } from '../components/JobDetailActions';
import { JobDetailHero } from '../components/JobDetailHero';
import { JobMatchCard } from '../components/JobMatchCard';
import { SimilarJobCard } from '../components/SimilarJobCard';
import { TailorResumeCta } from '../components/TailorResumeCta';
import { useJobsActions } from '../hooks/useJobsActions';

export type JobDetailScreenProps = { id: string };

/**
 * JOBS 05 — Job Detail (Figma 1:830).
 *
 * The header actions scroll with the page, as drawn: only node 1:923 is marked sticky. Back stays
 * reachable through the platform gesture and the Android hardware button once it scrolls away.
 */
export function JobDetailScreen({ id }: JobDetailScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const actions = useJobsActions();

  const job = useJob(id);
  const similar = useSimilarJobs(id);
  const toggleSave = useToggleSaveJob();
  // NOTIF 07: Apply submits for real, confirms with a toast and may raise the push primer.
  const applyFlow = useApplyFlow(job.data);

  const body = (children: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: colors.surfacePage, paddingTop: insets.top }]}>
      {children}
    </View>
  );

  if (job.isPending) {
    return body(
      <View style={{ padding: spacing.gutter, gap: spacing[4] }}>
        <Skeleton width={64} height={64} radius="xxl" />
        <Skeleton width="80%" height={34} />
        <Skeleton width="60%" height={22} />
        <Skeleton height={294} radius="cardLg" style={{ marginTop: spacing[4] }} />
        <Skeleton height={84} radius="card" />
      </View>,
    );
  }

  if (job.isError || !job.data) {
    return body(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load this job"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void job.refetch()}
        style={{ marginTop: spacing[10] }}
      />,
    );
  }

  const current: Job = job.data;

  return body(
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[2],
          paddingBottom: spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <IconButton icon="chevron-left" label="Back" onPress={actions.goBack} />
          <View style={[styles.headerRight, { gap: spacing[3] }]}>
            <IconButton icon="share-alt" label="Share this job" onPress={actions.shareJob} />
            <IconButton
              icon="bookmark"
              iconStyle={current.isSaved ? 'solid' : 'regular'}
              iconSize={17}
              label={current.isSaved ? 'Remove from saved' : 'Save job'}
              onPress={() => toggleSave.mutate(current.id)}
            />
          </View>
        </View>

        <JobDetailHero job={current} />

        {current.matchBand && current.matchCriteria?.length ? (
          <JobMatchCard
            band={current.matchBand}
            criteria={current.matchCriteria}
            onSeeFullCriteria={actions.openFullCriteria}
          />
        ) : null}

        <TailorResumeCta onPress={actions.tailorResume} />

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
                <Skeleton key={index} height={88} radius="card" />
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
              icon="briefcase"
              title="No similar jobs yet"
              message="We'll surface related roles as more come in."
            />
          )}
        </View>
      </ScrollView>

      <JobDetailActions
        saved={current.isSaved}
        onToggleSave={() => toggleSave.mutate(current.id)}
        onApply={applyFlow.apply}
      />

      <Toast
        visible={applyFlow.toastVisible}
        message={applyFlow.toastMessage}
        onHide={applyFlow.hideToast}
      />
      <PushPrimerHost />
    </>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
