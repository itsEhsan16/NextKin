import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { JD_SOURCE_LABEL, profileKeywordFit, type JdDraft } from '@/data/models';
import { useJdJob } from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';

import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { BuildTipCard } from '../components/BuildNotes';
import { BuildReviewCard } from '../components/BuildReviewCard';
import { BuildReviewSkeleton } from '../components/BuildReviewSkeleton';
import { BuildReviewSource } from '../components/BuildReviewSource';
import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { JdDoubleCheck } from '../components/JdDoubleCheck';
import { useBuildSource } from '../buildSourceStore';
import { useBuildActions } from '../hooks/useStartBuild';

export type BuildReviewScreenProps = {
  jdId: string;
  /** The uploaded file's name: the read draft keeps only its title. */
  fileName?: string;
};

const TITLE = 'Add the job — we read it';
const LEDE = 'We read the job description and pull out what it asks for.';
// Built from a resume (§139), the comparison is with that resume.
const ctaFor = (fromResume: boolean) => `Compare with my ${fromResume ? 'resume' : 'profile'}`;
const nextFor = (fromResume: boolean) =>
  `Next, we compare these with your ${fromResume ? 'resume' : 'profile'}.`;

// BUILD 04 at 390 (653:56), in artboard units.
const HEADER_TO_ART = 8 / 0.75; // 661:32 rides up over 653:60
const HERO_TO_SOURCE = 18 / 0.75; // 653:70
const BLOCK_GAP = 12 / 0.75; // 653:75 / 653:108
const SPARKLE_W = 18 / 0.75; // 653:114
const SPARKLE_H = 17.6315 / 0.75;

export const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/** The grey row's label: the link as typed (no scheme), "Pasted description", or the file. */
export function sourceLabel(draft: JdDraft, fileName?: string): string {
  if (draft.source === 'link' && draft.sourceUrl) {
    return draft.sourceUrl.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '');
  }
  if (draft.source === 'paste') return 'Pasted description';
  if (draft.source === 'file') return fileName ?? JD_SOURCE_LABEL.file;
  return JD_SOURCE_LABEL[draft.source];
}

/**
 * BUILD 04 (653:56) — the job as read (toreview §74): where it came from with a Change back to
 * BUILD 03, one card with what the job asks for, and "Compare with my profile", which opens BUILD
 * 04b. Nothing is spent here. Editing is the pencil on the card. Under the card, off the board
 * (toreview §145.4): the way to the whole job, and anything the job asks that nobody could have,
 * which only shows when there is some.
 */
export function BuildReviewScreen({ jdId, fileName }: BuildReviewScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const actions = useBuildActions();
  const fromResume = useBuildSource() != null;
  const cta = ctaFor(fromResume);

  const { draft, view } = useJdJob(jdId);

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!!draft.data);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={TITLE} showTitle={false} onBack={() => router.back()} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={footer}
    >
      <Animated.View entering={enter(0)}>
        <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.buildRead} />
      </Animated.View>
      <View style={styles.body}>{children}</View>
    </Screen>
  );

  const inertBar = <StickyActionBar floating primary={{ label: cta, disabled: true }} />;

  if (draft.isError) {
    return isNotFound(draft.error)
      ? page(
          <StateView
            icon="Briefcase01"
            title="We lost that job"
            message="Add it again to build your resume."
            actionLabel="Add the job"
            onAction={() => router.back()}
          />,
        )
      : page(
          <StateView
            tone="danger"
            icon="AlertTriangle"
            title="Couldn't load the job"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void draft.refetch()}
          />,
        );
  }

  if (!draft.data) return page(<BuildReviewSkeleton />, inertBar);

  const job = draft.data;
  const asks = profileKeywordFit(job, []).map((keyword) => keyword.label);

  return page(
    <>
      <Animated.View entering={enter(1)}>
        <BuildReviewSource label={sourceLabel(job, fileName)} onChange={() => router.back()} />
      </Animated.View>
      <Animated.View entering={enter(2)} style={styles.block}>
        <BuildReviewCard
          draft={job}
          asks={asks}
          onEdit={() => router.push({ pathname: '/create/jd-review', params: { draftId: jdId } })}
        />
        <Button
          label="See the whole job"
          variant="ghost"
          block
          onPress={() => router.push({ pathname: '/create/jd', params: { draftId: jdId } })}
        />
      </Animated.View>
      {view && view.plausibility.length > 0 ? (
        <Animated.View entering={enter(3)} style={styles.block}>
          <JdDoubleCheck notes={view.plausibility} />
        </Animated.View>
      ) : null}
      <Animated.View entering={enter(4)} style={styles.block}>
        <BuildTipCard text={nextFor(fromResume)} />
      </Animated.View>
    </>,
    <StickyActionBar
      floating
      primary={{
        label: cta,
        leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
        onPress: () => actions.openCompare({ jdId, ...(job.jobId ? { jobId: job.jobId } : {}) }),
      }}
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  body: { marginTop: s(HERO_TO_SOURCE) },
  block: { marginTop: s(BLOCK_GAP) },
}));
