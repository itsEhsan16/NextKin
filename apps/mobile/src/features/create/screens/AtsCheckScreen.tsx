import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useImportResume, useResumes, useStartGeneration, useSubscription } from '@/data/queries';
import { pickDocument, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import {
  ATS_CHECK_HONESTY_NOTE,
  ATS_CHECK_TITLE,
  CHECK_FAILED,
  FILE_CTA,
  IMPORT_FAILED,
  OPEN_CTA,
  PICK_FAILED,
  RUN_CTA,
  UPGRADE_CTA,
  atsCheckAllowance,
  atsCheckNote,
  resumeForSource,
  type AtsCheckSource,
} from '../atsCheckSetup';
import { AtsCheckSkeleton } from '../components/AtsCheckSkeleton';
import { AtsCheckLibrarySheet, AtsCheckSourcePicker } from '../components/AtsCheckSourcePicker';
import { UsageBanner } from '../components/UsageBanner';
import { useCreateActions } from '../hooks/useCreateActions';

export type AtsCheckScreenProps = { resumeId?: string };

/**
 * The standalone ATS check (V2 §7.8 / §4.1): score any document against our own published rubric,
 * with the job description optional. No artboard exists for it (plan §8), so it is assembled from
 * the built primitives alone. The quota sits at the top because §13.5 wants the limit known
 * BEFORE the work, and the honesty note sits under it because §7.8 makes that claim part of the
 * number rather than a footnote on it.
 */
export function AtsCheckScreen({ resumeId }: AtsCheckScreenProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const actions = useCreateActions();
  // The score panel and the rubric belong to the resumes area, whose actions hook is frozen here.
  const router = useRouter();

  const resumes = useResumes();
  const subscription = useSubscription();
  const start = useStartGeneration();
  const importResume = useImportResume();

  const [source, setSource] = useState<AtsCheckSource | null>(
    resumeId ? { kind: 'library', resumeId } : null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Cover letters are not scored against the resume rubric, so the library is narrowed to resumes.
  const documents = useMemo(
    () => (resumes.data ?? []).filter((resume) => resume.docType === 'resume'),
    [resumes.data],
  );
  const file = source?.kind === 'file' ? source.file : undefined;
  const resume = resumeForSource(documents, source);
  // Safe to read straight through: a subscription that failed to load never reaches here.
  const allowance = atsCheckAllowance(subscription.data?.usage);
  // A document that already carries a number costs nothing to open — see the primary below.
  const scored = !file && resume?.atsScore != null;
  const busy = importResume.isPending || start.isPending;

  const startCheck = useCallback(
    (id: string) =>
      start.mutate(
        { kind: 'ats_check', sourceResumeId: id },
        {
          onSuccess: (generation) => actions.openGeneration(generation.id),
          onError: () => setFailure(CHECK_FAILED),
        },
      ),
    [actions, start],
  );

  const chooseFile = useCallback(async () => {
    setFailure(null);
    setPicking(true);
    try {
      const picked = await pickDocument(['pdf', 'docx', 'txt']);
      // A cancel and an unavailable picker are one outcome: no file, and the page is untouched.
      if (picked) setSource({ kind: 'file', file: picked });
      else setFailure(PICK_FAILED);
    } finally {
      setPicking(false);
    }
  }, []);

  const submit = useCallback(() => {
    setFailure(null);
    if (file) {
      // §7.4: the parse also returns a profile DRAFT — not applied here, and not mentioned.
      importResume.mutate(file, {
        onSuccess: ({ resume: imported }) => startCheck(imported.id),
        onError: () => setFailure(IMPORT_FAILED),
      });
      return;
    }
    if (resume) startCheck(resume.id);
  }, [file, importResume, resume, startCheck]);

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={ATS_CHECK_TITLE} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* Always a sibling of the page, never a child of its scroller. */}
      <AtsCheckLibrarySheet
        open={sheetOpen}
        documents={documents}
        selectedId={resume?.id}
        onSelect={(id) => {
          setFailure(null);
          setSource({ kind: 'library', resumeId: id });
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom inset, so a page without one
  // would grow a footer out of nothing the moment the queries land.
  if (resumes.isPending || subscription.isPending) {
    return page(
      <AtsCheckSkeleton />,
      <StickyActionBar primary={{ label: RUN_CTA, disabled: true }} />,
    );
  }

  const errorPage = (title: string, retry: () => void) =>
    page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title={title}
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={retry}
      />,
    );

  if (resumes.isError) {
    return errorPage("Couldn't load your resumes", () => void resumes.refetch());
  }
  // An allowance that could not be read is unknown, not unlimited: nothing may be spent against
  // a cap the page never showed (§13.5).
  if (subscription.isError) {
    return errorPage("Couldn't load your plan", () => void subscription.refetch());
  }

  // An empty library is not a dead end: checking a document the app has never seen is the whole
  // point of the standalone check.
  if (!resume && !file) {
    return page(
      <StateView icon="file-alt" title="No resumes to check yet" />,
      <StickyActionBar
        note={failure ?? undefined}
        primary={{
          label: FILE_CTA,
          icon: 'file-upload',
          loading: picking,
          onPress: () => void chooseFile(),
        }}
      />,
    );
  }

  /**
   * §13.5 gates the ACTION that costs a check, not the screen. An already-scored document opens
   * its panel for free, so that branch is tested FIRST and stays reachable with the month's
   * allowance spent; only the branch that would start a run is replaced by the upsell.
   */
  const primary =
    scored && resume
      ? {
          label: OPEN_CTA,
          icon: 'chart-line',
          onPress: () =>
            router.push({ pathname: '/resumes/[id]/score', params: { id: resume.id } }),
        }
      : allowance.spent
        ? { label: UPGRADE_CTA, onPress: () => actions.openUpgrade('ats_checks') }
        : { label: RUN_CTA, icon: 'magic', loading: busy, onPress: submit };

  return page(
    <>
      {allowance.limit > 0 ? (
        <Animated.View entering={enter(0)}>
          <UsageBanner used={allowance.used} limit={allowance.limit} noun="check" />
        </Animated.View>
      ) : null}

      {/* §7.8: the honesty note is on the screen that buys the number, not buried behind it. */}
      <Animated.View entering={enter(1)}>
        <Text variant="captionRegular" color="textSecondary">
          {ATS_CHECK_HONESTY_NOTE}
        </Text>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <AtsCheckSourcePicker
          resume={resume}
          file={file}
          picking={picking}
          onChooseResume={() => setSheetOpen(true)}
          onChooseFile={() => void chooseFile()}
          onUseLibrary={() => {
            setFailure(null);
            setSource(null);
          }}
          // The rubric is addressed by document, so the link only exists once one is chosen.
          onOpenRubric={
            resume
              ? () => router.push({ pathname: '/resumes/[id]/rubric', params: { id: resume.id } })
              : undefined
          }
        />
      </Animated.View>
    </>,
    <StickyActionBar note={atsCheckNote({ failure, scored, allowance })} primary={primary} />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
