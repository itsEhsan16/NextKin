import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import type { Resume } from '@/data/models';
import { useInterviewSets, useResumes, useStartGeneration, useSubscription } from '@/data/queries';
// Deep import on purpose: the resumes barrel drags its screens in. docMeta is pure formatting.
import { docSubtitle } from '@/features/resumes/docMeta';
import { useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

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

export type NewInterviewSetScreenProps = { resumeId?: string };

const CTA = 'Write questions';
const ROLE_MIN = 3;

/**
 * NEW PRACTICE SET (V2 §7.15). No artboard covers it (plan §8, phase 9I); the shape is the ATS
 * check's — a source picker, the cap in front of the reader before the work, and a primary the
 * upsell replaces when the cap is spent (§13.5).
 *
 * The cap is per resume, so it is read off the sets that already exist for the chosen document
 * rather than off a flat counter — see `interviewQuota.ts`. Either mode starts the same async
 * run; the progress screen is shared with every other kind of AI work.
 */
export function NewInterviewSetScreen({ resumeId }: NewInterviewSetScreenProps) {
  const { spacing, s } = useTheme();
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
  const [roleTitle, setRoleTitle] = useState('');
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

  const page = (children: ReactNode, footer?: ReactNode) => (
    <>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="New question set" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        footer={footer}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      >
        {children}
      </Screen>
      {/* A sibling of the page, never a child of its scroller. */}
      <OptionSheet
        open={sheetOpen}
        title="Choose a resume"
        options={documents.map<SheetOption>((item) => ({
          key: item.id,
          label: item.title,
          caption: docSubtitle(item),
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

  // The inert bar is part of the loading state: it owns the bottom inset.
  if (resumes.isPending || subscription.isPending || sets.isPending) {
    return page(
      <View style={{ gap: spacing[4] }}>
        <Skeleton height={s(44)} radius="full" />
        <Skeleton height={s(72)} radius="card" />
        <Skeleton height={s(40)} />
      </View>,
      <StickyActionBar primary={{ label: CTA, disabled: true }} note={INTERVIEW_COST_NOTE} />,
    );
  }

  if (resumes.isError || sets.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
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
        icon="exclamation-triangle"
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
      <Text variant="body" color="textSecondary">
        A practice set of 10 to 20 questions with model answers — technical ones drawn from what
        your resume claims, behavioural ones from what the role asks.
      </Text>
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
    </>,
    // §13.5: the upsell REPLACES the action rather than interrupting the page.
    <StickyActionBar
      note={note}
      primary={
        allowance.spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('interview') }
          : { label: CTA, icon: 'magic', loading: start.isPending, onPress: submit }
      }
    />,
  );
}
