import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { JdInput } from '@/data/models';
import {
  useCurrentUser,
  useExtractJd,
  useJob,
  useStartGeneration,
  useSubscription,
} from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { JdIntakeSection } from '../components/JdIntakeSection';
import { JdIntakeSheets } from '../components/JdIntakeSheets';
import { UsageBanner } from '../components/UsageBanner';
import {
  ZeroResumeForm,
  ZeroResumeGuardrail,
  ZeroResumeSkeleton,
} from '../components/ZeroResumeForm';
import { GENERATION_COST_NOTE as COST_NOTE, spentNote } from '../generationQuota';
import { useCreateActions } from '../hooks/useCreateActions';
import {
  emptyZeroResumeDraft,
  fullNameOf,
  jdIsReady,
  validateZeroResume,
  zeroSeed,
  type ZeroResumeDraft,
} from '../zeroResume';

export type ZeroResumeScreenProps = Record<string, never>;

/** The primary's label, shared with the inert copy the loading state pins. */
const CTA = 'Draft my resume';

/**
 * §7.6 forbids a silent hang, and this press runs two steps behind one label. One sentence covers
 * both: which of the two failed is our problem rather than the reader's, and the retry is the
 * same press.
 */
const DRAFT_FAILED = "We couldn't start your draft. Check your connection and try again.";
const FIX_FIRST = 'Fill in the highlighted fields to start.';
const NEED_JD = 'Add the job description you want the draft written against.';

/** §7.9 lists the JD among its three inputs, so the section is marked rather than left implied. */
const JD_REQUIRED = 'Required.';

/**
 * CREATE — Zero Resume Mode (V2 §7.9): a first draft for someone who has no resume at all. No
 * artboard draws it (plan §8), so it is assembled from the built primitives alone.
 *
 * The integrity note is the screen. §7.9 is the module with the strictest guardrails in the spec,
 * because a resume generated from four fields must never read as a claim about a history nobody
 * told us about — so the card sits directly under the quota, read on arrival, before a single
 * field is typed. It is deliberately not parked at the foot of the page: the JD field below it
 * grows with a 12 000-character paste, which would push a bottom-anchored card off-screen exactly
 * when it matters most.
 *
 * The JD is required here rather than optional: §7.9's functional details name "a confirmed JD
 * extraction (7.5)" as one of the three inputs, and its first acceptance criterion is
 * "Name + years of experience + confirmed JD produces a complete draft".
 */
export function ZeroResumeScreen(_props: ZeroResumeScreenProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const actions = useCreateActions();

  const user = useCurrentUser();
  const subscription = useSubscription();
  const extract = useExtractJd();
  const start = useStartGeneration();

  const [draft, setDraft] = useState<ZeroResumeDraft>(emptyZeroResumeDraft);
  const [jd, setJd] = useState<JdInput | null>(null);
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [refused, setRefused] = useState(false);

  // The prefill lands once, when the user query settles, and never again: the field is the
  // reader's from that moment on, so a refetch must not type over a name they changed.
  const seeded = useRef(false);
  const currentUser = user.data;
  useEffect(() => {
    if (seeded.current || !currentUser) return;
    seeded.current = true;
    setDraft((current) => ({ ...current, fullName: fullNameOf(currentUser) }));
  }, [currentUser]);

  // The query the intake's own summary card already runs, deduped by key: the CTA must not start
  // an extraction against a saved job the app could not read.
  const jdJob = useJob(jd?.source === 'job' ? jd.jobId : '');

  // Safe to read straight through: a subscription that failed to load never reaches here — see
  // the error branch below — so this is the published cap rather than a zero standing in for one.
  const usage = subscription.data?.usage;
  const limit = usage?.generationsLimit ?? 0;
  const used = usage?.generationsUsed ?? 0;
  const spent = used >= limit;

  const check = validateZeroResume(draft);
  const allErrors = check.ok ? {} : check.errors;
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const jdOk = jdIsReady(jd, jdJob.data != null);
  const blocked = !check.ok ? FIX_FIRST : !jdOk ? NEED_JD : undefined;

  // Two mutations chained, on purpose: §7.9 generates against an extraction and the draft id only
  // exists once `extract` resolves, so the run cannot be described until then. Unlike the tailor
  // flow (§7.5) nothing stops in between — this flow's review gate is on the OUTPUT, where every
  // assumed line comes back flagged and blocks download until it is resolved.
  const submit = useCallback(() => {
    if (!jd || !validateZeroResume(draft).ok || !jdIsReady(jd, jdJob.data != null)) {
      setRefused(true);
      return;
    }
    extract.mutate(jd, {
      onSuccess: (extracted) =>
        start.mutate(
          { kind: 'zero_resume', jdId: extracted.id, zero: zeroSeed(draft) },
          { onSuccess: (generation) => actions.openGeneration(generation.id) },
        ),
    });
  }, [actions, draft, extract, jd, jdJob.data, start]);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = extract.isError || start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(DRAFT_FAILED);
  }, [failed]);

  const enter = (i: number) =>
    reduced ? undefined : FadeInDown.delay(i * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Start from nothing" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* A sibling of the page, never a child of its scroller — see `JdIntakeSheets`. */}
      <JdIntakeSheets value={jd} onChange={setJd} />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (subscription.isPending || user.isPending) {
    return page(
      <ZeroResumeSkeleton />,
      <StickyActionBar primary={{ label: CTA, disabled: true }} note={COST_NOTE} />,
    );
  }

  // An allowance that could not be read is unknown, not unlimited: §13.5 wants the cap in front of
  // the reader before the work, so nothing is spent against a cap the page never showed. A user
  // that failed to load is not fatal in the same way — it costs the name prefill and nothing
  // else, and that field is the reader's to type anyway.
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

  return page(
    <>
      {/*
        §13.3 also publishes a separate "Zero Resume drafts: 1 / month on Free" row, but the data
        layer models no zeroResumeUsed counter — and §13.3's own note says the draft counts toward
        the generation quota — so the page meters and gates on generations until that row exists.
      */}
      <Animated.View entering={enter(0)}>
        <UsageBanner used={used} limit={limit} noun="generation" />
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <ZeroResumeGuardrail />
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <ZeroResumeForm
          draft={draft}
          errors={errors}
          onChange={setDraft}
          onBlurField={(key) => setTouched((current) => ({ ...current, [key]: true }))}
        />
      </Animated.View>

      <Animated.View entering={enter(3)} style={{ gap: spacing[2] }}>
        <JdIntakeSection value={jd} onChange={setJd} />
        <Text variant="caption" color="textSecondary">
          {JD_REQUIRED}
        </Text>
      </Animated.View>
    </>,
    // The button stays live while the form is incomplete: pressing it is how the reader finds out
    // what is missing, which is kinder than a dead control with no stated reason.
    <StickyActionBar
      // One line, in the order that matters: what broke, then the cap, then what is missing.
      note={failed ? DRAFT_FAILED : spent ? spentNote(limit) : (refused && blocked) || COST_NOTE}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: CTA,
              icon: 'magic',
              loading: extract.isPending || start.isPending,
              onPress: submit,
            }
      }
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
