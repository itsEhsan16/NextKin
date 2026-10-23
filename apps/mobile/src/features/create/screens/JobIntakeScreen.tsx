import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { JdInput } from '@/data/models';
import {
  isConsentRequired,
  isUnreadableFileError,
  unreadableJdId,
  useExtractJd,
} from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { JdIntakeSheets } from '../components/JdIntakeSheets';
import { JobIntake, jobIntakeReady } from '../components/JobIntake';
import { useCreateActions } from '../hooks/useCreateActions';

export type JobIntakeScreenProps = {
  /** "Tailor this resume" from the library: Customize opens on it instead of the base. */
  resumeId?: string;
};

export const INTAKE_CTA = 'Analyze job';
const READ_FAILED = "We couldn't read that description. Check your connection and try again.";
const UNREADABLE = 'We couldn’t read that file. Paste the text of the posting instead.';

// The flow hero's distance from the header (ZERO 01 613:213), in artboard units.
const HEADER_TO_HERO = 12 / 0.75;
const HERO_TO_INTAKE = 22 / 0.75;

/**
 * "Add a job" (toreview §114): the first of the two screens before a tailored resume. Paste the
 * posting, upload it or pick a saved job; Analyze reads it and opens Customize for it with the
 * base resume, with no review step in between ("Details" there corrects what was read). A saved
 * job needs no reading, so it goes straight through. Spec-derived from the shared JD intake.
 */
export function JobIntakeScreen({ resumeId }: JobIntakeScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();
  const extract = useExtractJd();
  const [jd, setJd] = useState<JdInput | null>(null);
  const enter = useRevealStagger(true);

  const failure =
    extract.isError && !isConsentRequired(extract.error)
      ? isUnreadableFileError(extract.error) || unreadableJdId(extract.error)
        ? UNREADABLE
        : READ_FAILED
      : undefined;

  // The bar's note is a live region on Android only, so the failure is announced as well.
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (failure && failure !== announced.current)
      AccessibilityInfo.announceForAccessibility(failure);
    announced.current = failure;
  }, [failure]);

  const analyze = () => {
    if (!jobIntakeReady(jd)) return;
    if (jd.source === 'job') {
      actions.openCustomize({ jobId: jd.jobId, resumeId }, { replace: true });
      return;
    }
    extract.mutate(jd, {
      onSuccess: (draft) => actions.openCustomize({ jdId: draft.id, resumeId }, { replace: true }),
    });
  };

  return (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Add a job" showTitle={false} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={
          <StickyActionBar
            note={failure}
            noteTone="danger"
            primary={{
              label: INTAKE_CTA,
              icon: 'magic',
              loading: extract.isPending,
              disabled: !jobIntakeReady(jd),
              onPress: analyze,
            }}
          />
        }
      >
        <Animated.View entering={enter(0)}>
          <FlowHero
            art={FLOW_ART.buildAdd}
            title="Add a job"
            lede="Paste the posting, upload it or pick a saved job. Next, we compare your resume with it."
          />
        </Animated.View>
        <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_INTAKE) }}>
          <JobIntake value={jd} onChange={setJd} />
        </Animated.View>
      </Screen>
      <JdIntakeSheets value={jd} onChange={setJd} />
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  root: { flex: 1 },
}));
