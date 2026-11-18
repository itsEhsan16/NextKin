import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { motion, scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { TailorResumeSheet } from '../components/TailorResumeSheet';
import { FlowCard, FlowFooter, StatusPill } from '../flow/FlowKit';
import { RESUME_STEP_COUNT, StepHelpSheet, stepName } from '../flow/ResumeSteps';
import { useCreateActions, type CustomizeTarget } from '../hooks/useCreateActions';
import { useCustomizeData } from '../hooks/useCustomizeData';

export type Method = 'tailor' | 'profile' | 'zero' | 'upload';

export const METHOD_TITLE = 'How would you like to create your resume?';

/** The web's four ways (`apps/web/src/features/tailor/flow/methods.ts`), with the app's clay art. */
export const METHODS: readonly {
  key: Method;
  title: string;
  line: string;
  art: number;
  recommended?: boolean;
}[] = [
  {
    key: 'tailor',
    title: 'Tailor my selected resume',
    line: 'Keep your facts and aim them at this job. The quickest way.',
    art: require('../../../../assets/illustrations/redesign/job-match.webp'),
    recommended: true,
  },
  {
    key: 'profile',
    title: 'Create from my profile',
    line: 'A new resume written from the roles and skills in your profile.',
    art: require('../../../../assets/illustrations/build/build-job.webp'),
  },
  {
    key: 'zero',
    title: 'Start from scratch with AI',
    line: 'Answer a few questions and AI drafts a first resume.',
    art: require('../../../../assets/illustrations/redesign/empty-resume.webp'),
  },
  {
    key: 'upload',
    title: 'Upload a resume',
    line: 'Bring a PDF or Word file and tailor it to this job.',
    art: require('../../../../assets/illustrations/ats/ats-upload.webp'),
  },
];

/**
 * Tailor and Build, "1 of 3 · Job & Resume", second half (owner, 2026-11-18, toreview §234): how
 * to make the resume for the job just chosen, as the web's method step asks it. Tailor and
 * Upload open the resume sheet (pick one, or upload); Profile goes to the profile against the job;
 * Scratch to Zero Resume. A tap picks a card; Continue goes on.
 */
export function MethodScreen({ jobId, jdId }: Omit<CustomizeTarget, 'resumeId'>) {
  const styles = useStyles();
  const actions = useCreateActions();
  const data = useCustomizeData({ jobId, jdId });
  const [method, setMethod] = useState<Method | null>(null);
  const [sheet, setSheet] = useState(false);
  const [help, setHelp] = useState(false);
  const enter = useRevealStagger(!!data.target);
  const { target, resumes, profile } = data;
  const hasResume = (resumes.data?.length ?? 0) > 0;
  const hasRoles = (profile.data?.experiences.length ?? 0) > 0;
  // With no resume yet, Tailor can't be the default advice: the profile, or a start from nothing.
  // Until the library has loaded, Tailor stays the advice: "no resume" is only said once known.
  const recommended: Method =
    !resumes.data || hasResume ? 'tailor' : !profile.data || hasRoles ? 'profile' : 'zero';
  const job = target ? `${target.title}${target.company ? ` · ${target.company}` : ''}` : undefined;

  const go = () => {
    if (!method) return;
    if (method === 'tailor' || method === 'upload') setSheet(true);
    else if (method === 'profile') actions.openBuildCompare({ jobId, jdId });
    else actions.openZeroResume({ jobId, role: target?.title });
  };

  const disabledLine = (key: Method) =>
    key === 'tailor' && resumes.data && !hasResume
      ? 'No resume yet. Upload one, or pick another way.'
      : key === 'profile' && profile.data && !hasRoles
        ? 'Your profile has no roles yet. Add one first.'
        : null;

  return (
    <View style={styles.root}>
      <OnboardingFrame
        step={1}
        total={RESUME_STEP_COUNT}
        stepName={stepName(1)}
        title={METHOD_TITLE}
        subtitle={job ? `For ${job}` : undefined}
        onBack={actions.goBack}
        onHelp={() => setHelp(true)}
        footer={
          <FlowFooter
            primary={{ label: 'Continue', icon: 'ArrowRight', disabled: !method, onPress: go }}
          />
        }
      >
        {data.targetMissing ? (
          <StateView
            icon="Briefcase01"
            title="This job isn’t available"
            message="It may have closed or been removed."
            actionLabel="Back"
            onAction={actions.goBack}
          />
        ) : (
          <View style={styles.stack} accessibilityRole="radiogroup">
            {METHODS.map((m, index) => {
              const off = disabledLine(m.key);
              return (
                <Animated.View key={m.key} entering={enter(index)}>
                  <MethodCard
                    title={m.title}
                    line={off ?? m.line}
                    art={m.art}
                    recommended={m.key === recommended}
                    selected={method === m.key}
                    disabled={off !== null}
                    onPress={() => setMethod(m.key)}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}
      </OnboardingFrame>
      <TailorResumeSheet
        open={sheet}
        job={target ?? { title: 'this job' }}
        onClose={() => setSheet(false)}
        onCompare={(resumeId) => {
          setSheet(false);
          actions.openCustomize({ jobId, jdId, resumeId });
        }}
      />
      <StepHelpSheet step={1} open={help} onClose={() => setHelp(false)} />
    </View>
  );
}

function MethodCard({
  title,
  line,
  art,
  recommended,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  line: string;
  art: number;
  recommended: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      feedback="subtle"
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}${recommended ? ', recommended' : ''}. ${line}`}
      disabled={disabled}
      onPress={onPress}
    >
      <FlowCard
        style={[
          styles.card,
          {
            borderWidth: sizes.borderThick,
            borderColor: selected ? colors.brand : 'transparent',
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <View style={[styles.artBox, { backgroundColor: colors.brandSurface }]}>
          <Image
            source={art}
            style={styles.art}
            contentFit="contain"
            accessible={false}
            cachePolicy="memory"
            transition={motion.durations.imageFade}
          />
        </View>
        <View style={styles.text}>
          {recommended ? <StatusPill label="Recommended" tone="brand" /> : null}
          <Text variant="bodyLgStrong" color="ink">
            {title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {line}
          </Text>
        </View>
        <Radio on={selected} />
      </FlowCard>
    </Pressable>
  );
}

function Radio({ on }: { on: boolean }) {
  const { colors, sizes, u } = useTheme();
  return (
    <View
      style={{
        width: u(24),
        height: u(24),
        borderRadius: u(12),
        borderWidth: on ? u(7) : sizes.borderThick,
        borderColor: on ? colors.brand : colors.progressTrack,
      }}
    />
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(14), paddingBottom: u(8) },
  card: { flexDirection: 'row', alignItems: 'center', gap: u(14) },
  artBox: {
    width: u(96),
    height: u(80),
    borderRadius: u(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: u(88), height: u(70) },
  text: { flex: 1, gap: u(4) },
}));
