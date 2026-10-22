import { useMemo, useState, type ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type { Job } from '@/data/models';
import { useJobPicks, useSavedJobs } from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SearchField } from '@/ui/SearchField';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { BuildJobCard, BuildJobRow, BuildJobRowSkeleton } from '../components/BuildJobRows';
import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { useBuildActions, useBuildQuota } from '../hooks/useStartBuild';

type Tab = 'saved' | 'top';

const TITLE = 'Choose a job';
const LEDE = 'Pick the job you want this resume built for.';

// BUILD 02 at 390 (652:76), in artboard units.
const HEADER_TO_ART = 23 / 0.75; // 652:80 → 661:28
const HERO_TO_SEARCH = 18 / 0.75; // 652:90
const SEARCH_TO_TABS = 10 / 0.75; // 652:94
const TABS_TO_LIST = 12 / 0.75; // 652:99
const SPARKLE_W = 18 / 0.75; // 652:158
const SPARKLE_H = 17.6315 / 0.75;
const SKELETON_ROWS = 5;

const matches = (job: Job, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return job.title.toLowerCase().includes(needle) || job.company.toLowerCase().includes(needle);
};

/**
 * BUILD 02 (652:76) — "Choose a job", BUILD 01's See all: every saved job, or the top matches,
 * searchable here on the phone. The first job is picked, so the CTA is ready at once; it opens
 * BUILD 04b, the profile against that job. The quota line says what the build there will cost.
 */
export function BuildChooseJobScreen() {
  const { motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const actions = useBuildActions();
  const quota = useBuildQuota();

  const saved = useSavedJobs();
  const picks = useJobPicks();
  const [tab, setTab] = useState<Tab>('saved');
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string>();

  const source = tab === 'saved' ? saved : picks;
  const list = useMemo(
    () => (source.data ?? []).filter((job) => matches(job, query)),
    [source.data, query],
  );
  // A pick filtered out by the search falls back to the first row still showing.
  const picked = list.find((job) => job.id === pickedId) ?? list[0];

  const segments: readonly Segment<Tab>[] = [
    { key: 'saved', label: saved.data ? `Saved jobs (${saved.data.length})` : 'Saved jobs' },
    { key: 'top', label: 'Top matches' },
  ];

  let body: ReactNode;
  if (source.isError) {
    body = (
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your jobs"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void source.refetch()}
      />
    );
  } else if (!source.data) {
    body = (
      <BuildJobCard>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <BuildJobRowSkeleton key={index} />
        ))}
      </BuildJobCard>
    );
  } else if (source.data.length === 0) {
    body =
      tab === 'saved' ? (
        <StateView
          icon="bookmark"
          title="No saved jobs yet"
          message="Save jobs you like and they'll show up here."
          actionLabel="Browse jobs"
          onAction={actions.browseJobs}
        />
      ) : (
        <StateView
          icon="briefcase"
          title="No top matches yet"
          message="Complete your profile and we'll find jobs that fit."
          actionLabel="Browse jobs"
          onAction={actions.browseJobs}
        />
      );
  } else if (list.length === 0) {
    body = (
      <StateView
        icon="search"
        title="No jobs match your search"
        message="Try a different title or company."
        actionLabel="Clear search"
        onAction={() => setQuery('')}
      />
    );
  } else {
    body = (
      <BuildJobCard selectedIndex={list.findIndex((job) => job.id === picked?.id)}>
        {list.map((job) => (
          <BuildJobRow
            key={job.id}
            job={job}
            variant="radio"
            selected={job.id === picked?.id}
            onPress={() => setPickedId(job.id)}
          />
        ))}
      </BuildJobCard>
    );
  }

  const bar = (
    <StickyActionBar
      floating
      note={quota.quotaNote || undefined}
      primary={
        quota.quotaSpent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : picked
            ? {
                label: `Build resume for ${picked.company}`,
                leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
                onPress: () => actions.openCompare({ jobId: picked.id }),
              }
            : { label: 'Build resume', disabled: true }
      }
    />
  );

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={TITLE} showTitle={false} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={bar}
    >
      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(motion.durations.base)}
        style={{ marginBottom: s(HERO_TO_SEARCH) }}
      >
        <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.buildChoose} />
      </Animated.View>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search your jobs"
        accessibilityLabel="Search your jobs"
      />
      <SegmentedControl
        segments={segments}
        value={tab}
        onChange={setTab}
        style={{ marginTop: s(SEARCH_TO_TABS) }}
      />
      <Animated.View
        key={tab}
        entering={reduced ? undefined : FadeIn.duration(motion.durations.base)}
        style={{ marginTop: s(TABS_TO_LIST) }}
      >
        {body}
      </Animated.View>
    </Screen>
  );
}
