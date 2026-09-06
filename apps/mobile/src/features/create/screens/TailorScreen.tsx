import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { JdInput } from '@/data/models';
import { useExtractJd, useJob, useResumes, useSubscription } from '@/data/queries';
// Deep import on purpose: the resumes barrel drags its screens in, and this file is reachable
// from the create barrel that @/navigation imports. docMeta is pure formatting.
import { docSubtitle } from '@/features/resumes/docMeta';
import { a11yButton, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { JdIntakeSection, jdInputForJob } from '../components/JdIntakeSection';
import { JdIntakeSheets } from '../components/JdIntakeSheets';
import { TailorSkeleton } from '../components/TailorSkeleton';
import { UsageBanner } from '../components/UsageBanner';
import { spentNote } from '../generationQuota';
import { useCreateActions } from '../hooks/useCreateActions';

export type TailorScreenProps = { jobId?: string; resumeId?: string };

/** Grouped-row metrics, matching ListRow so this row lines up with every other carded row. */
const ROW_PADDING = 20;
const ROW_GUTTER = 16;
const CHEVRON = 11;

/** The primary's label, shared with the inert copy the loading state pins. */
const CTA = 'Review job description';

/**
 * V2 §7.6 forbids a silent hang, and extraction is the step in front of it. The reason goes on
 * the bar that started the work — the CTA is pinned, so a line at the end of the scroll content
 * would be off-screen below a 12 000-character paste, and pressing the button would look like
 * nothing happening at all.
 */
const EXTRACT_FAILED = "We couldn't read that description. Check your connection and try again.";

/**
 * Tailor a resume — the intake that turns a job description into a tailored one (V2 §7.5). No
 * artboard exists for it (plan §8), so it is assembled from the built primitives alone.
 *
 * The quota sits at the top of the page rather than behind the button because §13.5 wants the
 * limit known BEFORE work begins; and when it is spent the upgrade prompt REPLACES the CTA
 * instead of interrupting the page, because the same section forbids an upsell that cuts across
 * work in progress.
 */
export function TailorScreen({ jobId, resumeId }: TailorScreenProps) {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useCreateActions();

  const resumes = useResumes();
  const subscription = useSubscription();
  const extract = useExtractJd();

  const [chosenId, setChosenId] = useState<string | undefined>(resumeId);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Arriving from a listing means the JD is already chosen: nothing to pick, and the CTA goes live
  // as soon as that listing is read.
  const [jd, setJd] = useState<JdInput | null>(() => jdInputForJob(jobId));

  // The query the intake's summary card already runs, deduped by key: the CTA must not start an
  // extraction against a listing the app could not read.
  const jdJob = useJob(jd?.source === 'job' ? jd.jobId : '');

  // Cover letters are never a tailoring source, so the library is narrowed to resumes here and
  // the empty state below is about resumes rather than "documents".
  const documents = useMemo(
    () => (resumes.data ?? []).filter((resume) => resume.docType === 'resume'),
    [resumes.data],
  );
  const base =
    documents.find((resume) => resume.id === chosenId) ??
    documents.find((resume) => resume.isBase) ??
    documents[0];

  // Safe to read straight through: a subscription that failed to load never reaches here — see
  // the error branch below — so this is the published cap rather than a zero standing in for one.
  const usage = subscription.data?.usage;
  const limit = usage?.generationsLimit ?? 0;
  const used = usage?.generationsUsed ?? 0;
  const spent = used >= limit;

  // A pasted description that is only whitespace is not a description, and a saved job the app
  // could not read is not one either.
  const ready =
    jd != null &&
    (jd.source !== 'paste' || jd.text.trim().length > 0) &&
    (jd.source !== 'job' || jdJob.data != null);

  const submit = useCallback(() => {
    if (!jd) return;
    extract.mutate(jd, { onSuccess: (draft) => actions.openJdReview(draft.id, base?.id) });
  }, [actions, base?.id, extract, jd]);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = extract.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(EXTRACT_FAILED);
  }, [failed]);

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Tailor a resume" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* Both sheets are siblings of the page, never children of its scroller. */}
      <OptionSheet
        open={sheetOpen}
        title="Choose a base resume"
        options={documents.map<SheetOption>((resume) => ({
          key: resume.id,
          label: resume.title,
          caption: docSubtitle(resume),
        }))}
        selectedKey={base?.id}
        onSelect={(id) => {
          setChosenId(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
      <JdIntakeSheets value={jd} onChange={setJd} />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a 150pt footer out of nothing the moment the queries land.
  if (resumes.isPending || subscription.isPending) {
    return page(<TailorSkeleton />, <StickyActionBar primary={{ label: CTA, disabled: true }} />);
  }

  if (resumes.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your resumes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void resumes.refetch()}
      />,
    );
  }

  // An allowance that could not be read is unknown, not unlimited: §13.5 wants the cap in front
  // of the user before the work, so nothing is spent against a cap the page never showed.
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

  if (!base) {
    return page(
      <StateView
        icon="file-alt"
        title="Add a base resume first"
        message="Tailoring starts from a resume you already have."
        actionLabel="Upload a resume"
        onAction={actions.openUpload}
      />,
    );
  }

  // One line on the bar, and never the quota: the banner above already says how many are left, and
  // repeating it here draws it twice on the page and announces it twice to a screen reader.
  const note = failed ? EXTRACT_FAILED : spent ? spentNote(limit) : undefined;

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <UsageBanner used={used} limit={limit} noun="generation" />
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ gap: spacing[3] }}>
        <Text variant="groupLabel">Base resume</Text>
        <Card radius="card" padding={0}>
          <Pressable
            {...a11yButton(`Base resume, ${base.title}`, 'Choose a different resume')}
            feedback="subtle"
            haptic="light"
            onPress={() => setSheetOpen(true)}
            style={[
              styles.row,
              {
                minHeight: sizes.listRow,
                paddingHorizontal: s(ROW_PADDING),
                paddingVertical: spacing[3],
                gap: s(ROW_GUTTER),
              },
            ]}
          >
            <View style={styles.rowText}>
              <Text variant="rowTitle" numberOfLines={1}>
                {base.title}
              </Text>
              <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                {docSubtitle(base)}
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
          </Pressable>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <JdIntakeSection value={jd} onChange={setJd} jobId={jobId} />
      </Animated.View>
    </>,
    // The failure leaves the button live, so pressing it again is the retry.
    <StickyActionBar
      note={note}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: CTA,
              icon: 'magic',
              loading: extract.isPending,
              disabled: !ready,
              onPress: submit,
            }
      }
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, gap: s(2) },
}));
