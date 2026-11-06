import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image } from 'expo-image';

import { ZERO_YEARS_LABEL } from '@/data/models';
import { useCurrentUser, useJob, useStartGeneration, useSubscription } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { ZeroAboutForm, ZeroAboutFormSkeleton } from '../components/ZeroAboutForm';
import { FlowCard, FlowDivider, FlowFooter, FlowRow } from '../flow/FlowKit';
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

const ART = require('../../../../assets/illustrations/redesign/empty-resume.webp');

const TITLE = 'Let’s write your first resume';
const LEDE = 'We draft it. You check every guess.';

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
  const { colors } = useTheme();
  const styles = useStyles();
  /** Prefilled answers show as a summary first; a tap on any row opens the form (§173). */
  const [editing, setEditing] = useState(false);
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
    <OnboardingFrame
      step={1}
      total={3}
      title={TITLE}
      subtitle={LEDE}
      onBack={actions.goBack}
      art={<Image source={ART} style={styles.art} contentFit="contain" accessible={false} />}
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
        <ZeroAboutFormSkeleton />
      </View>,
      <FlowFooter primary={{ label: ZERO_CTA, onPress: () => {}, disabled: true }} />,
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

  const complete = Object.keys(allErrors).length === 0;
  const edit = <Icon name="Edit03" size="sm" color={colors.textSecondary} />;
  const summary = (
    <FlowCard style={styles.summary}>
      <FlowRow
        icon="User01"
        title={about.fullName}
        body="Name"
        trailing={edit}
        onPress={() => setEditing(true)}
        accessibilityLabel={`Name, ${about.fullName}. Edit`}
      />
      <FlowDivider />
      <FlowRow
        icon="Briefcase01"
        title={about.role}
        body="Role you want"
        trailing={edit}
        onPress={() => setEditing(true)}
        accessibilityLabel={`Role you want, ${about.role}. Edit`}
      />
      <FlowDivider />
      <FlowRow
        icon="Clock"
        title={
          about.years === 'none'
            ? 'Just starting'
            : `${about.years ? ZERO_YEARS_LABEL[about.years] : ''} years`
        }
        body="Experience"
        trailing={edit}
        onPress={() => setEditing(true)}
        accessibilityLabel="Experience. Edit"
      />
    </FlowCard>
  );

  return page(
    <Animated.View entering={enter(0)}>
      {complete && !editing ? (
        <>
          {summary}
          <Text variant="footnote" color="textTertiary" style={styles.hint}>
            From your answers so far. Tap a row to change it.
          </Text>
        </>
      ) : (
        <ZeroAboutForm
          about={about}
          errors={errors}
          onChange={setAbout}
          onBlurField={(key) => setTouched((current) => ({ ...current, [key]: true }))}
        />
      )}
    </Animated.View>,
    // The button stays live while the form is incomplete: pressing it says what is missing.
    <FlowFooter
      note={
        failed ? ZERO_START_FAILED : spent ? spentNote(limit) : generationsLeftNote(used, limit)
      }
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : { label: ZERO_CTA, icon: 'Stars02', loading: start.isPending, onPress: write }
      }
    />,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  art: { width: u(120), height: u(120) },
  summary: { paddingVertical: u(4) },
  hint: { marginTop: u(12) },
}));
