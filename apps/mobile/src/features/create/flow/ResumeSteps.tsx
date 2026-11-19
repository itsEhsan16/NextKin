import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

/**
 * The resume flow's three steps, named as the web names them (`TailorScreen` STEPS), so the app
 * and the website walk the same path: the job and the resume, the keywords, the run.
 */
export const RESUME_STEPS = ['Job & Resume', 'Choose Keywords', 'Generate Results'] as const;
export const RESUME_STEP_COUNT = RESUME_STEPS.length;
export type ResumeStep = 1 | 2 | 3;

export const stepName = (step: ResumeStep) => RESUME_STEPS[step - 1];

/** What the help button says on each step: what it is for, in a few lines. */
const HELP: Record<ResumeStep, { title: string; lines: string[] }> = {
  1: {
    title: 'Job & resume',
    lines: [
      'Pick the job, then how to make the resume for it.',
      'Tailoring your own resume is the quickest: we keep your facts and aim them at this job.',
      'No resume yet? Build one from your profile, start from nothing with AI, or upload one.',
    ],
  },
  2: {
    title: 'Choosing keywords',
    lines: [
      'These are the words this job asks for that your resume doesn’t show yet.',
      'Tick only what you really have. We add what you tick, and interviewers may ask about any of it.',
      'Each keyword shows roughly what it adds to your ATS score, out of 10.',
    ],
  },
  3: {
    title: 'Generating your resume',
    lines: [
      'We rewrite your resume for this job from your own facts and the keywords you chose, then check its ATS score.',
      'It takes about a minute. You can leave; we’ll let you know when it’s ready.',
    ],
  },
};

/** The help sheet behind the step header's (?) button. */
export function StepHelpSheet({
  step,
  open,
  onClose,
}: {
  step: ResumeStep;
  open: boolean;
  onClose: () => void;
}) {
  const { u } = useTheme();
  const styles = useStyles();
  const help = HELP[step];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      height={u(400)}
      accessibilityLabel={help.title}
      contentStyle={styles.pad}
    >
      <OptionSheetHeader title={help.title} onClose={onClose} />
      <View style={styles.body}>
        {help.lines.map((line) => (
          <Text key={line} variant="bodyLg" color="textSecondary">
            {line}
          </Text>
        ))}
        <Button label="Got it" size="xl" block onPress={onClose} />
      </View>
    </Sheet>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  pad: { paddingHorizontal: u(24), paddingBottom: u(12) },
  body: { paddingTop: u(8), paddingBottom: u(12), gap: u(14) },
}));
