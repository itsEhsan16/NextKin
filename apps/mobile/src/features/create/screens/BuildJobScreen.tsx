import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUser, useProfile, useSavedJobs } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { BuildJobCard, BuildJobRow, BuildJobRowSkeleton } from '../components/BuildJobRows';
import { OrDivider } from '../components/BuildNotes';
import {
  BUILD_LEDE,
  BUILD_TITLE,
  BuildAnywhereTile,
  BuildFromProfileRow,
  BuildSectionTitle,
} from '../components/BuildSourceRows';
import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { useBuildActions } from '../hooks/useStartBuild';

// BUILD 01 at 390 (652:2), in artboard units.
const HEADER_TO_ART = 22 / 0.75; // 652:6 → 661:26
const HERO_TO_SECTION = 22 / 0.75; // 652:16
const TITLE_TO_CARD = 10 / 0.75; // 652:21
const CARD_TO_OR = 16 / 0.75; // 652:57 / 652:62
const EMPTY_GAP = 12 / 0.75;
const TOP_JOBS = 3;

/**
 * BUILD 01 (652:2) — "Which job is this resume for?", Home's Build Resume (toreview §74): the top
 * three saved jobs, a job from anywhere under the OR, and the profile the resume is built from,
 * pinned at the foot. A job opens BUILD 04b, the profile against the job; nothing is spent until
 * the build starts there.
 */
export function BuildJobScreen() {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const actions = useBuildActions();

  const saved = useSavedJobs();
  const profile = useProfile();
  const user = useCurrentUser();

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!!saved.data);

  const jobs = saved.data ?? [];
  const top = jobs.slice(0, TOP_JOBS);

  let savedBlock: ReactNode;
  if (saved.isError) {
    savedBlock = (
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your saved jobs"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void saved.refetch()}
      />
    );
  } else if (!saved.data) {
    savedBlock = (
      <BuildJobCard>
        {Array.from({ length: TOP_JOBS }, (_, index) => (
          <BuildJobRowSkeleton key={index} />
        ))}
      </BuildJobCard>
    );
  } else if (top.length === 0) {
    savedBlock = (
      <View style={styles.empty}>
        <Text variant="body" color="textSecondary">
          No saved jobs yet. Save one from Jobs, or add a job from anywhere below.
        </Text>
        <Button label="Browse jobs" variant="secondary" onPress={actions.browseJobs} />
      </View>
    );
  } else {
    savedBlock = (
      <BuildJobCard>
        {top.map((job) => (
          <BuildJobRow
            key={job.id}
            job={job}
            variant="link"
            onPress={() => actions.openCompare({ jobId: job.id })}
          />
        ))}
      </BuildJobCard>
    );
  }

  const roles = profile.data?.experiences.length;
  const skills = profile.data?.skills.length;
  const footer =
    roles != null && skills != null ? (
      <View
        style={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[4],
          paddingBottom: spacing[4] + insets.bottom,
        }}
      >
        <BuildFromProfileRow
          name={user.data?.firstName ?? ''}
          avatarUrl={user.data?.avatarUrl}
          roles={roles}
          skills={skills}
          onEdit={actions.openProfileEditor}
        />
      </View>
    ) : undefined;

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={BUILD_TITLE} showTitle={false} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={footer}
    >
      <Animated.View entering={enter(0)}>
        <FlowHero title={BUILD_TITLE} lede={BUILD_LEDE} art={FLOW_ART.buildJob} />
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_SECTION) }}>
        <BuildSectionTitle
          title="Your saved jobs"
          linkLabel={jobs.length > 0 ? `See all (${jobs.length})` : undefined}
          onLink={actions.openChooseJob}
        />
        <View style={{ marginTop: s(TITLE_TO_CARD) }}>{savedBlock}</View>
      </Animated.View>

      <Animated.View entering={enter(2)} style={[styles.anywhere, { marginTop: s(CARD_TO_OR) }]}>
        <OrDivider />
        <BuildAnywhereTile onPress={actions.openAddJob} />
      </Animated.View>
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  empty: { gap: s(EMPTY_GAP), alignItems: 'flex-start' },
  anywhere: { gap: s(CARD_TO_OR) },
}));
