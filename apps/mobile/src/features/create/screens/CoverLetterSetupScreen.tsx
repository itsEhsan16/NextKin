import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { CoverLetterTone } from '@/data/models';
import { useResumes, useStartGeneration, useSubscription } from '@/data/queries';
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

import { CoverLetterSkeleton } from '../components/CoverLetterSkeleton';
import { CoverLetterTonePicker } from '../components/CoverLetterTonePicker';
import { UsageBanner } from '../components/UsageBanner';
import {
  COVER_LETTER_COST_NOTE,
  COVER_LETTER_CTA,
  COVER_LETTER_START_FAILED,
  coverLetterSources,
  coverLetterSpentNote,
  DEFAULT_COVER_LETTER_TONE,
  pickCoverLetterSource,
} from '../coverLetterSetup';
import { useCreateActions } from '../hooks/useCreateActions';

export type CoverLetterSetupScreenProps = { resumeId?: string };

/** Grouped-row metrics, matching ListRow so this row lines up with every other carded row. */
const ROW_PADDING = 20;
const ROW_GUTTER = 16;
const CHEVRON = 11;

/**
 * CREATE — cover letter setup (V2 §7.10). A letter is written against a resume version and the
 * job that resume was tailored to, so this screen picks that pair and a tone, and nothing else.
 * No artboard covers this flow (plan §8, phase 9), so it is assembled from built primitives.
 *
 * The quota sits at the top rather than behind the button because §13.5 wants the limit known
 * BEFORE the work; and when it is spent the upgrade prompt REPLACES the CTA instead of
 * interrupting the page, because the same section forbids an upsell that cuts across work.
 */
export function CoverLetterSetupScreen({ resumeId }: CoverLetterSetupScreenProps) {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useCreateActions();

  const resumes = useResumes();
  const subscription = useSubscription();
  const start = useStartGeneration();

  const [chosenId, setChosenId] = useState<string | undefined>(resumeId);
  const [tone, setTone] = useState<CoverLetterTone>(DEFAULT_COVER_LETTER_TONE);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sources = useMemo(() => coverLetterSources(resumes.data ?? []), [resumes.data]);
  const source = pickCoverLetterSource(sources, chosenId);

  // Safe to read straight through: a subscription that failed to load never reaches here (see the
  // error branch), so this is the published cap rather than a zero standing in for one. And a
  // plan that grants none is spent rather than unlimited — 0 of 0 leaves nothing to write.
  const usage = subscription.data?.usage;
  const limit = usage?.coverLettersLimit ?? 0;
  const used = usage?.coverLettersUsed ?? 0;
  const spent = used >= limit;

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(COVER_LETTER_START_FAILED);
  }, [failed]);

  const write = () => {
    if (!source) return;
    start.mutate(
      {
        kind: 'cover_letter',
        sourceResumeId: source.id,
        tone,
        ...(source.linkedJobId ? { jobId: source.linkedJobId } : {}),
      },
      // Navigate from the callback, not beside the call: the mock ticker only advances while the
      // progress screen is subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );
  };

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Write a cover letter" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* Sibling of the page, never a child of its scroller: its root is an absolute fill. */}
      <OptionSheet
        open={sheetOpen}
        title="Choose a resume"
        options={sources.map<SheetOption>((resume) => ({
          key: resume.id,
          label: resume.title,
          caption: docSubtitle(resume),
        }))}
        selectedKey={source?.id}
        onSelect={(id) => {
          setChosenId(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (resumes.isPending || subscription.isPending) {
    return page(
      <CoverLetterSkeleton />,
      <StickyActionBar primary={{ label: COVER_LETTER_CTA, disabled: true }} />,
    );
  }

  const retryState = (title: string, onAction: () => void) => (
    <StateView
      tone="danger"
      icon="exclamation-triangle"
      title={title}
      message="Check your connection and try again."
      actionLabel="Try again"
      onAction={onAction}
    />
  );

  if (resumes.isError) {
    return page(retryState("Couldn't load your resumes", () => void resumes.refetch()));
  }

  // An allowance that could not be read is unknown, not unlimited: §13.5 wants the cap in front
  // of the user before the work, so nothing is spent against a cap the page never showed.
  if (subscription.isError) {
    return page(retryState("Couldn't load your plan", () => void subscription.refetch()));
  }

  // §7.10 writes the letter from a resume AND the job it was tailored to. With neither in hand
  // there is nothing honest to write from, so the way out is the flow that makes the pair.
  if (!source) {
    return page(
      <StateView
        icon="magic"
        title="Tailor a resume first"
        // §7.10's constraint, and it must be stated rather than implied: this branch fires with a
        // library full of resumes, none of them linked to a job. Without it the reader sees five
        // documents and a screen that will not use any of them, which reads as a bug.
        message="A letter is written from a resume and the job it was tailored to."
        actionLabel="Tailor a resume"
        onAction={actions.openTailor}
      />,
    );
  }

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <UsageBanner used={used} limit={limit} noun="cover letter" />
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ gap: spacing[3] }}>
        <Text variant="groupLabel">Written from</Text>
        <Card radius="card" padding={0}>
          <Pressable
            {...a11yButton(`Written from ${source.title}`, 'Choose a different resume')}
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
                {source.title}
              </Text>
              <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                {docSubtitle(source)}
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
          </Pressable>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <CoverLetterTonePicker value={tone} onChange={setTone} />
      </Animated.View>
    </>,
    // One line, and never the quota: the banner already says how many are left, and repeating it
    // announces it twice. A failure leaves the button live, so a second press is the retry.
    <StickyActionBar
      note={
        failed
          ? COVER_LETTER_START_FAILED
          : spent
            ? coverLetterSpentNote(limit)
            : COVER_LETTER_COST_NOTE
      }
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('cover_letters') }
          : {
              label: COVER_LETTER_CTA,
              icon: 'magic',
              loading: start.isPending,
              onPress: write,
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
