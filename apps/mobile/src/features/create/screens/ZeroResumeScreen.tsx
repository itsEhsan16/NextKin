import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image } from 'expo-image';

import { ZERO_YEARS, ZERO_YEARS_LABEL, type ZeroYears } from '@/data/models';
import { useCurrentUser, useJob, useStartGeneration, useSubscription } from '@/data/queries';
import { motion, scaledSheet } from '@/theme';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { Reveal, useRevealStagger } from '@/ui/motion';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { FlowFooter } from '../flow/FlowKit';
import { generationsLeftNote, spentNote } from '../generationQuota';
import { useCreateActions } from '../hooks/useCreateActions';
import { SUGGESTED_ROLES, useSetupAnswers } from '../setupAnswers';
import {
  emptyZeroAbout,
  fullNameOf,
  NAME_MAX,
  ROLE_MAX,
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

const ART = require('../../../../assets/illustrations/redesign/empty-resume.webp');

/** The three questions, one per screen (owner, 2026-11-07: "one thing at a time", §175). */
const STEPS = ['fullName', 'years', 'role'] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Step, { title: string; subtitle: string }> = {
  fullName: { title: 'What’s your name?', subtitle: 'As it should read on your resume.' },
  years: { title: 'How long have you worked?', subtitle: 'None is a fine answer.' },
  role: { title: 'What role do you want?', subtitle: 'We’ll write your draft toward it.' },
};

const yearsLabel = (band: ZeroYears): string =>
  band === 'none' ? 'None yet' : `${ZERO_YEARS_LABEL[band]} years`;

/** A tapped experience band moves on by itself, after the chip has shown it picked. */
const ADVANCE_MS = 280;

/**
 * Zero Resume's start, one question per screen (§175, replacing ZERO 01's three-field card): the
 * name to print, how long you have worked, and the role you want. Each answer that is already
 * known (the account's name, the sign-up answers, the job's title) is filled in, so a known answer
 * is one tap. No job description is asked for (toreview §57.4). Opened from a job (ZERO 00b), the
 * run remembers the job.
 *
 * The quota line sits on the last step's bar, over the button that spends it (§13.5). Once the
 * allowance is spent, the plans replace the button from the first step, before anything is asked.
 */
export function ZeroResumeScreen({ jobId, role }: ZeroResumeScreenProps) {
  const styles = useStyles();
  const actions = useCreateActions();

  const user = useCurrentUser();
  const job = useJob(jobId ?? '');
  const subscription = useSubscription();
  const start = useStartGeneration();

  const [step, setStep] = useState(0);
  // The experience band answered at sign-up starts picked, so it is never asked twice (§172).
  const [about, setAbout] = useState<ZeroAbout>(() => ({
    ...emptyZeroAbout,
    years: useSetupAnswers.getState().years,
  }));
  /** The current step's Continue was pressed with nothing valid: say what is missing. */
  const [refused, setRefused] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (advance.current && clearTimeout(advance.current)), []);

  // Each prefill lands once, when its query settles, and never again: the answer is the reader's
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

  const enter = useRevealStagger(!subscription.isPending && !user.isPending);
  const current = STEPS[step]!;
  const error = refused ? validateZeroAbout(about)[current] : undefined;

  const back = () => {
    setRefused(false);
    if (step === 0) actions.goBack();
    else setStep(step - 1);
  };

  const page = (children: ReactNode, footer?: ReactNode) => (
    <OnboardingFrame
      step={step + 1}
      total={STEPS.length}
      title={COPY[current].title}
      subtitle={COPY[current].subtitle}
      onBack={back}
      art={
        step === 0 ? (
          <Image
            source={ART}
            style={styles.art}
            contentFit="contain"
            accessible={false}
            cachePolicy="memory"
            transition={motion.durations.imageFade}
          />
        ) : undefined
      }
      footer={footer}
    >
      {children}
    </OnboardingFrame>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (subscription.isPending || user.isPending) {
    return page(
      <View accessible accessibilityLabel="Loading your details">
        <Skeleton height={56} radius="xl" />
      </View>,
      <FlowFooter primary={{ label: 'Continue', onPress: () => {}, disabled: true }} />,
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
  const last = step === STEPS.length - 1;

  const next = () => {
    if (validateZeroAbout(about)[current]) {
      setRefused(true);
      return;
    }
    setRefused(false);
    if (!last) {
      setStep(step + 1);
      return;
    }
    start.mutate(
      { kind: 'zero_resume', zero: zeroSeedFrom(about), ...(jobId ? { jobId } : {}) },
      // Navigate from the callback, not beside the call: the mock ticker only advances while the
      // progress screen is subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );
  };

  const pickYears = (band: ZeroYears) => {
    setAbout((now) => ({ ...now, years: band }));
    setRefused(false);
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(() => setStep(STEPS.indexOf('role')), ADVANCE_MS);
  };

  const question =
    current === 'fullName' ? (
      <TextField
        label="Full name"
        icon="User01"
        value={about.fullName}
        onChangeText={(fullName) => setAbout((now) => ({ ...now, fullName }))}
        error={error}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        onSubmit={next}
      />
    ) : current === 'years' ? (
      <View>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {ZERO_YEARS.map((band) => (
            <ChoiceChip
              radio
              key={band}
              label={yearsLabel(band)}
              selected={about.years === band}
              onPress={() => pickYears(band)}
            />
          ))}
        </View>
        {error ? (
          <Text
            variant="footnote"
            color="danger"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {error}
          </Text>
        ) : null}
      </View>
    ) : (
      <View>
        <TextField
          label="Role you want"
          icon="Briefcase01"
          value={about.role}
          onChangeText={(text) => setAbout((now) => ({ ...now, role: text }))}
          error={error}
          maxLength={ROLE_MAX}
          autoCapitalize="words"
          placeholder="Product Designer"
          returnKeyType="done"
        />
        <View style={styles.chips}>
          {SUGGESTED_ROLES.map((suggestion) => (
            <ChoiceChip
              key={suggestion}
              label={suggestion}
              selected={about.role === suggestion}
              onPress={() => setAbout((now) => ({ ...now, role: suggestion }))}
            />
          ))}
        </View>
      </View>
    );

  return page(
    <Animated.View entering={enter(0)}>
      {/* Each question cross-fades in as the last one goes. */}
      <Reveal stateKey={current}>{question}</Reveal>
    </Animated.View>,
    spent ? (
      <FlowFooter
        note={spentNote(limit)}
        primary={{ label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }}
      />
    ) : last ? (
      <FlowFooter
        note={failed ? ZERO_START_FAILED : generationsLeftNote(used, limit)}
        noteTone={failed ? 'danger' : 'neutral'}
        primary={{ label: ZERO_CTA, icon: 'Stars02', loading: start.isPending, onPress: next }}
      />
    ) : (
      <FlowFooter primary={{ label: 'Continue', onPress: next }} />
    ),
  );
}

const useStyles = scaledSheet((_s, u) => ({
  art: { width: u(120), height: u(120) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(14) },
  error: { marginTop: u(10) },
}));
