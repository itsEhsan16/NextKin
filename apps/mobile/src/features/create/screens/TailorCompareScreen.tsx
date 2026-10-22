import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { nothingChosen, tailorRunInput } from '@/data/models/customize';
import { isConsentRequired, useStartGeneration } from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { CustomizeKeywords } from '../components/CustomizeKeywords';
import { CustomizeOptions } from '../components/CustomizeOptions';
import { NoResumeCard } from '../components/NoResumeCard';
import { TailorCompareSkeleton } from '../components/TailorCompareSkeleton';
import { TailorHero } from '../components/TailorHero';
import { TailorImproveCard } from '../components/TailorImproveCard';
import { TailorResumeSheet } from '../components/TailorResumeSheet';
import { TailorStepper } from '../components/TailorStepper';
import { TailorVsCard } from '../components/TailorVsCard';
import { customizeKey, useCustomizeChoices } from '../customizeStore';
import { generationsLeftNote, spentNote } from '../generationQuota';
import { useCreateActions, type CustomizeTarget } from '../hooks/useCreateActions';
import { useCustomizeData } from '../hooks/useCustomizeData';

export type TailorCompareScreenProps = CustomizeTarget;

export const CUSTOMIZE_CTA = 'Create my resume';
const START_FAILED = "We couldn't start it. Check your connection and try again.";
const NOTHING_CHOSEN = 'Turn on something to improve, or tap a keyword.';

// TAILOR 02 at 390 (607:2), in artboard units.
const HEADER_TO_STEPS = 12 / 0.75;
const STEPS_TO_HERO = 22 / 0.75;
const HERO_TO_CARD = 20 / 0.75;
const SECTION_GAP = 24 / 0.75;
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;

/**
 * Customize (toreview §114, owner 2026-10-19): everything before "Create my resume", on one
 * screen, for a listing or a JD the user brought. The base resume is picked for them (Change
 * swaps it); the score is said out of 10 with its band; missing keywords are chips the user taps
 * when they have them, each with an optional "Used in…"; the parts to improve sit folded under
 * Options, all on. One button starts the run `tailorRunInput` builds — the same one the web asks
 * for. With no resume yet, the page offers upload, a build from the profile, or a fresh start.
 *
 * Spec-derived (CLAUDE.md rule 7): no board draws the merged screen, so it is TAILOR 02's
 * language and primitives throughout.
 */
export function TailorCompareScreen(props: TailorCompareScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();
  const data = useCustomizeData(props);
  const start = useStartGeneration();
  const [choices, update] = useCustomizeChoices(customizeKey(props, data.resumeId));
  const [pickerOpen, setPickerOpen] = useState(false);

  const { target, comparison, resume, subscription, resumes } = data;
  const enter = useRevealStagger(
    !!target && !!resume.data && !!comparison.data && !!subscription.data,
  );
  const sheetJob = target ?? { title: 'this job' };

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Customize" showTitle={false} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_STEPS) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        <TailorStepper current="compare" />
        <View style={{ marginTop: s(STEPS_TO_HERO) }}>{children}</View>
      </Screen>

      {/* The sheets are siblings of the page, never children of its scroller. */}
      <TailorResumeSheet
        open={pickerOpen}
        job={sheetJob}
        selectedResumeId={data.resumeId || undefined}
        onClose={() => setPickerOpen(false)}
        onCompare={(id) => {
          setPickerOpen(false);
          if (id !== data.resumeId) actions.compareResume(id);
        }}
      />
    </View>
  );

  const retry = (title: string, onAction: () => void) =>
    page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title={title}
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

  if (data.targetMissing) {
    return page(
      <StateView
        icon="briefcase"
        title="This job isn't available"
        message="It may have closed or been removed."
        actionLabel="Back"
        onAction={actions.goBack}
      />,
    );
  }
  if (data.targetQuery.isError) {
    return retry("Couldn't load this job", () => void data.targetQuery.refetch());
  }
  if (resumes.isError || subscription.isError) {
    return retry("Couldn't load your resumes", () => {
      if (resumes.isError) void resumes.refetch();
      if (subscription.isError) void subscription.refetch();
    });
  }

  const inertBar = <StickyActionBar floating primary={{ label: CUSTOMIZE_CTA, disabled: true }} />;
  if (!target || !resumes.data || !subscription.data) {
    return page(<TailorCompareSkeleton />, inertBar);
  }

  if (data.noResume) {
    const roles = data.profile.data?.experiences.length ?? 0;
    const where = { jobId: props.jobId, jdId: props.jdId };
    return page(
      <View style={{ gap: s(SECTION_GAP) }}>
        <View style={{ gap: spacing[2] }}>
          <Text {...a11yHeader()} variant="headlineLg">
            {'Let’s tailor a resume\nfor this job'}
          </Text>
          <Text variant="captionRegular" color="textSecondary">
            {`${target.title}${target.company ? ` at ${target.company}` : ''}`}
          </Text>
        </View>
        <NoResumeCard
          onUpload={() => setPickerOpen(true)}
          onBuild={roles > 0 ? () => actions.openBuildCompare(where) : undefined}
          onStartFromNothing={
            roles > 0
              ? undefined
              : () => actions.openZeroResume({ jobId: props.jobId, role: target.title })
          }
        />
      </View>,
    );
  }

  if (resume.isError || comparison.isError) {
    return retry("Couldn't compare your resume", () => {
      if (resume.isError) void resume.refetch();
      if (comparison.isError) void comparison.refetch();
    });
  }
  if (!resume.data || !comparison.data) {
    return page(<TailorCompareSkeleton />, inertBar);
  }

  const result = comparison.data;
  const { generationsUsed: used, generationsLimit: limit } = subscription.data.usage;
  const spent = used >= limit;
  const empty = nothingChosen(choices);
  // A consent refusal is the dialog's to handle; it carries on from there (toreview §114).
  const failed = start.isError && !isConsentRequired(start.error);

  const create = () => {
    start.mutate(tailorRunInput(result, choices, props.jobId), {
      onSuccess: (generation) => actions.openGeneration(generation.id),
    });
  };

  const note = failed
    ? START_FAILED
    : spent
      ? spentNote(limit)
      : empty
        ? NOTHING_CHOSEN
        : generationsLeftNote(used, limit);
  const jdId = data.jdId;

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <TailorHero
          score={result.score}
          company={data.company}
          outOfTen
          scored={result.scored !== false}
        />
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_CARD) }}>
        <TailorVsCard
          target={target}
          resume={resume.data}
          onChange={() => setPickerOpen(true)}
          onDetails={jdId ? () => actions.openJobDetails(jdId) : undefined}
        />
      </Animated.View>
      <Animated.View entering={enter(2)} style={{ marginTop: s(SECTION_GAP) }}>
        <CustomizeKeywords
          comparison={result}
          choices={choices}
          onChange={(n) => update(() => n)}
        />
      </Animated.View>
      <Animated.View entering={enter(4)} style={{ marginTop: s(SECTION_GAP) }}>
        <TailorImproveCard improvements={result.improvements} />
      </Animated.View>
      <Animated.View entering={enter(5)} style={{ marginTop: s(SECTION_GAP) }}>
        <CustomizeOptions choices={choices} onChange={(n) => update(() => n)} />
      </Animated.View>
    </>,
    <StickyActionBar
      floating
      note={note}
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: CUSTOMIZE_CTA,
              leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
              haptic: 'medium',
              loading: start.isPending,
              disabled: empty,
              onPress: create,
            }
      }
    />,
  );
}

const useStyles = scaledSheet(() => ({
  root: { flex: 1 },
}));
