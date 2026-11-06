import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import SparkleWhite from '../../../../assets/icons/ai-sparkle-white.svg';
import type { Resume } from '@/data/models';
import { useInterviewSets, useResumes, useStartGeneration, useSubscription } from '@/data/queries';
// Deep imports on purpose: those barrels drag their screens in. These are plain pieces.
import { FLOW_ART, FlowHero } from '@/features/create/components/FlowHero';
import { AiPill } from '@/features/resumes/components/AiPill';
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { docSubtitle } from '@/features/resumes/docMeta';
import { scaledSheet, useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import {
  InterviewSourcePicker,
  type InterviewSourceMode,
} from '../components/InterviewSourcePicker';
import { useInterviewActions } from '../hooks/useInterviewActions';
import {
  INTERVIEW_COST_NOTE,
  INTERVIEW_START_FAILED,
  interviewAllowance,
  interviewSpentNote,
} from '../interviewQuota';

export type NewInterviewSetScreenProps = {
  resumeId?: string;
  /** Filled in for role mode when an application opens this: the job's own title. */
  roleTitle?: string;
};

const TITLE = 'New question set';
const LEDE = 'Written from a resume and the job it was tailored to, or from a role title alone.';
const CTA = 'Write questions';
const ROLE_MIN = 3;

// INTERVIEW 02 / 03 at 390 (577:1861 / 577:2809), in artboard units.
const HEADER_TO_ART = 36; // 577:1868 → 674:18
const HERO_TO_CONTROL = 14; // 577:1891 → 577:1893
const SPARKLE_W = 18;
const SPARKLE_H = 18.622;
const SHEET_THUMB = 36; // 577:2902
const SHEET_THUMB_RADIUS = 8;

/**
 * INTERVIEW 02 / 03 (577:1861, 577:2809) — a new practice set (V2 §7.15): the hero, a source
 * picker as step 1 of one card, the cap in front of the reader before the work, and a primary the
 * upsell replaces when the cap is spent (§13.5). The resume row opens INTERVIEW 03's sheet.
 *
 * The cap is per resume, so it is read off the sets that already exist for the chosen document
 * rather than off a flat counter — see `interviewQuota.ts`. Either mode starts the same async
 * run; the progress screen is shared with every other kind of AI work.
 */
export function NewInterviewSetScreen({
  resumeId,
  roleTitle: givenRole,
}: NewInterviewSetScreenProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useInterviewActions();

  const resumes = useResumes();
  const subscription = useSubscription();
  const sets = useInterviewSets();
  const start = useStartGeneration();

  const documents = useMemo(
    () =>
      (resumes.data ?? []).filter(
        (resume) => resume.docType === 'resume' && resume.status === 'ready',
      ),
    [resumes.data],
  );
  const libraryEmpty = resumes.isSuccess && documents.length === 0;

  const [chosenMode, setMode] = useState<InterviewSourceMode>('resume');
  const [chosenId, setChosenId] = useState<string | undefined>(resumeId);
  const [roleTitle, setRoleTitle] = useState(givenRole ?? '');
  const [refused, setRefused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // An empty library pins the picker to role mode: that path always works, so it is never a
  // dead end, and the segment that could not be satisfied is not offered. Derived, not synced.
  const mode: InterviewSourceMode = libraryEmpty ? 'role' : chosenMode;

  const resume: Resume | undefined =
    documents.find((item) => item.id === chosenId) ??
    documents.find((item) => item.isBase) ??
    documents[0];
  const resumeMode = mode === 'resume' && !libraryEmpty;

  const allowance = interviewAllowance(
    sets.data ?? [],
    resumeMode ? resume?.id : undefined,
    subscription.data?.usage,
  );
  const trimmedRole = roleTitle.trim();
  const roleError =
    refused && trimmedRole.length < ROLE_MIN
      ? 'Add the role title the questions are for.'
      : undefined;
  const ready = resumeMode ? resume != null : trimmedRole.length >= ROLE_MIN;

  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(INTERVIEW_START_FAILED);
  }, [failed]);

  const submit = useCallback(() => {
    if (!ready) {
      setRefused(true);
      return;
    }
    start.mutate(
      resumeMode && resume
        ? {
            kind: 'interview',
            sourceResumeId: resume.id,
            ...(resume.linkedJobId ? { jobId: resume.linkedJobId } : {}),
          }
        : { kind: 'interview', title: trimmedRole },
      // Navigate from onSuccess: the mock ticker only advances while the progress screen is
      // subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );
  }, [actions, ready, resume, resumeMode, start, trimmedRole]);

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!resumes.isPending && !subscription.isPending && !sets.isPending);

  // INTERVIEW 03's rows lead with the page in a bordered 36 tile (577:2902).
  const thumb = (
    <View
      style={[
        styles.sheetThumb,
        {
          backgroundColor: colors.surfaceCard,
          borderWidth: sizes.border,
          borderColor: colors.borderDefault,
        },
      ]}
    >
      <ResumeThumbnail style={styles.fill} />
    </View>
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <>
      <Screen
        wash
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader
            title={TITLE}
            showTitle={false}
            onBack={actions.goBack}
            trailing={<AiPill />}
          />
        }
        headerStyle={styles.header}
        footer={footer}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        {children}
      </Screen>
      {/* A sibling of the page, never a child of its scroller. */}
      <OptionSheet
        open={sheetOpen}
        title="Choose a resume"
        variant="card"
        options={documents.map<SheetOption>((item) => ({
          key: item.id,
          label: item.title,
          caption: docSubtitle(item),
          leading: thumb,
        }))}
        selectedKey={resume?.id}
        onSelect={(id) => {
          setChosenId(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );

  const hero = (
    <Animated.View entering={enter(0)}>
      <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.interviewNew} />
    </Animated.View>
  );

  // The inert bar is part of the loading state: it owns the bottom inset.
  if (resumes.isPending || subscription.isPending || sets.isPending) {
    return page(
      <>
        {hero}
        <View
          style={[styles.body, { gap: s(HERO_TO_CONTROL / 0.75) }]}
          accessible
          accessibilityLabel="Loading your resumes"
          accessibilityState={{ busy: true }}
        >
          <Skeleton height={sizes.segmentedControl} radius="lg" />
          <Skeleton height={s(190 / 0.75)} radius="cardLg" />
        </View>
      </>,
      <StickyActionBar
        floating
        primary={{ label: CTA, disabled: true }}
        note={INTERVIEW_COST_NOTE}
      />,
    );
  }

  if (resumes.isError || sets.isError) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your resumes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void resumes.refetch();
          void sets.refetch();
        }}
      />,
    );
  }

  // An allowance that could not be read is unknown, not unlimited (§13.5).
  if (subscription.isError) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your plan"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void subscription.refetch()}
      />,
    );
  }

  const note = failed
    ? INTERVIEW_START_FAILED
    : allowance.spent
      ? interviewSpentNote(allowance.perTarget, resumeMode ? 'resume' : 'standalone')
      : INTERVIEW_COST_NOTE;

  return page(
    <>
      {hero}
      <Animated.View entering={enter(1)} style={styles.body}>
        <InterviewSourcePicker
          mode={mode}
          onChangeMode={setMode}
          resume={resumeMode ? resume : undefined}
          onChooseResume={() => setSheetOpen(true)}
          roleTitle={roleTitle}
          onChangeRoleTitle={(value) => {
            setRoleTitle(value);
            setRefused(false);
          }}
          roleError={roleError}
          libraryEmpty={libraryEmpty}
        />
      </Animated.View>
    </>,
    // §13.5: the upsell REPLACES the action rather than interrupting the page.
    <StickyActionBar
      floating
      note={note}
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        allowance.spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('interview') }
          : {
              label: CTA,
              leading: <SparkleWhite width={s(SPARKLE_W / 0.75)} height={s(SPARKLE_H / 0.75)} />,
              loading: start.isPending,
              onPress: submit,
            }
      }
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  header: { paddingBottom: s(HEADER_TO_ART / 0.75) },
  body: { marginTop: s(HERO_TO_CONTROL / 0.75) },
  sheetThumb: {
    width: s(SHEET_THUMB / 0.75),
    height: s(SHEET_THUMB / 0.75),
    borderRadius: s(SHEET_THUMB_RADIUS / 0.75),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
}));
