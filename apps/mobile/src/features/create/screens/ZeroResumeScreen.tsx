import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { useCurrentUser, useJob, useStartGeneration, useSubscription } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { FlowStepper, ZERO_STEPS } from '../components/TailorStepper';
import { ZeroAboutForm, ZeroAboutFormSkeleton } from '../components/ZeroAboutForm';
import { generationsLeftNote, spentNote } from '../generationQuota';
import { useCreateActions } from '../hooks/useCreateActions';
import { useSetupAnswers } from '../setupAnswers';
import {
  emptyZeroAbout,
  fullNameOf,
  validateZeroAbout,
  ZERO_CTA,
  ZERO_START_FAILED,
  zeroSeedFrom,
  type ZeroAbout,
} from '../zeroResume';

export type ZeroResumeScreenProps = {
  /** Set when "Start from nothing" was picked on a job (ZERO 00b); the run comes back to it. */
  jobId?: string;
  /** The role to start from when there is no listing: a pasted JD's title (toreview §114). */
  role?: string;
};

// ZERO 01 at 390 (613:206), in artboard units.
const HEADER_TO_STEPS = 12 / 0.75; // 613:212
const STEPS_TO_ART = 50 / 0.75; // 613:213 → 661:25
const HERO_TO_FORM = 22 / 0.75; // 613:249
const SPARKLE_W = 18 / 0.75; // 613:283
const SPARKLE_H = 17.6315 / 0.75;

const TITLE = 'Let’s write your first resume';
const LEDE = 'Three answers. We draft the rest and flag every guess.';

/**
 * ZERO 01 (613:206) — "Let's write your first resume": the name, a years band and the role you
 * want, then Write my draft (V2 §7.9). No job description is asked for: the owner chose the role
 * over a JD so someone with no resume and no job in mind can start (toreview §57.4). Opened from a
 * job (ZERO 00b), the role starts as that job's title and the run remembers the job.
 *
 * The quota line sits on the bar over the button that spends it (§13.5); once the allowance is
 * spent the upgrade prompt replaces the button rather than interrupting the page.
 */
export function ZeroResumeScreen({ jobId, role }: ZeroResumeScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();

  const user = useCurrentUser();
  const job = useJob(jobId ?? '');
  const subscription = useSubscription();
  const start = useStartGeneration();

  // The experience band answered at sign-up starts picked, so it is never asked twice (§172).
  const [about, setAbout] = useState<ZeroAbout>(() => ({
    ...emptyZeroAbout,
    years: useSetupAnswers.getState().years,
  }));
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Partial<Record<keyof ZeroAbout, true>>>({});
  const [refused, setRefused] = useState(false);

  // Each prefill lands once, when its query settles, and never again: the field is the reader's
  // from that moment, so a refetch must not type over a name or role they changed.
  const seededName = useRef(false);
  const seededRole = useRef(false);
  const currentUser = user.data;
  const setup = useSetupAnswers();
  const jobTitle = job.data?.title ?? role ?? (setup.role || undefined);
  useEffect(() => {
    if (seededName.current || !currentUser) return;
    seededName.current = true;
    setAbout((current) => ({ ...current, fullName: fullNameOf(currentUser) }));
  }, [currentUser]);
  useEffect(() => {
    if (seededRole.current || !jobTitle) return;
    seededRole.current = true;
    setAbout((current) => (current.role ? current : { ...current, role: jobTitle }));
  }, [jobTitle]);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(ZERO_START_FAILED);
  }, [failed]);

  const allErrors = validateZeroAbout(about);
  const errors = Object.fromEntries(
    Object.entries(allErrors).filter(([key]) => refused || touched[key as keyof ZeroAbout]),
  );

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!subscription.isPending && !user.isPending);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Zero Resume" showTitle={false} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_STEPS) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={footer}
    >
      <FlowStepper steps={ZERO_STEPS} current="about" />
      <View style={{ marginTop: s(STEPS_TO_ART) }}>{children}</View>
    </Screen>
  );

  const hero = (
    <Animated.View entering={enter(0)}>
      <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.zeroAbout} />
    </Animated.View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (subscription.isPending || user.isPending) {
    return page(
      <>
        {hero}
        <View style={styles.form} accessible accessibilityLabel="Loading your details">
          <ZeroAboutFormSkeleton />
        </View>
      </>,
      <StickyActionBar floating primary={{ label: ZERO_CTA, disabled: true }} />,
    );
  }

  // An allowance that could not be read is unknown, not unlimited: §13.5 wants the cap in front
  // of the reader before the work. A user that failed to load costs only the name prefill.
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

  const { generationsUsed: used, generationsLimit: limit } = subscription.data.usage;
  const spent = used >= limit;

  const write = () => {
    if (Object.keys(validateZeroAbout(about)).length > 0) {
      setRefused(true);
      return;
    }
    start.mutate(
      { kind: 'zero_resume', zero: zeroSeedFrom(about), ...(jobId ? { jobId } : {}) },
      // Navigate from the callback, not beside the call: the mock ticker only advances while the
      // progress screen is subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );
  };

  return page(
    <>
      {hero}
      <Animated.View entering={enter(1)} style={styles.form}>
        <ZeroAboutForm
          about={about}
          errors={errors}
          onChange={setAbout}
          onBlurField={(key) => setTouched((current) => ({ ...current, [key]: true }))}
        />
      </Animated.View>
    </>,
    // The button stays live while the form is incomplete: pressing it is how the reader finds out
    // what is missing, which is kinder than a dead control with no stated reason.
    <StickyActionBar
      floating
      note={
        failed ? ZERO_START_FAILED : spent ? spentNote(limit) : generationsLeftNote(used, limit)
      }
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: ZERO_CTA,
              leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
              loading: start.isPending,
              onPress: write,
            }
      }
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  form: { marginTop: s(HERO_TO_FORM) },
}));
