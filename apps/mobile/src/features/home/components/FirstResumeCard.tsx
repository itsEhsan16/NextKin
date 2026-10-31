import { View } from 'react-native';

import type { FirstResumeStage } from '@/features/create/firstResume';
import { FirstResumeSteps } from '@/features/create/components/FirstResumeSteps';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

export const FIRST_RESUME_CARD_TITLE = 'Your first resume';
export const FIRST_RESUME_CARD_CLOSE = 'Hide this card';

export type FirstResumeCardProps = {
  stage: Exclude<FirstResumeStage, 'done'>;
  onAddResume: () => void;
  onPickJob: () => void;
  onDismiss: () => void;
};

/**
 * For someone who skipped the first-resume screen (V2 §7.2's guided checklist, toreview §145.2):
 * the same three steps, and a button for the next one. It leaves on its own once a resume has been
 * made for a job, and the ✕ puts it away sooner.
 */
export function FirstResumeCard({ stage, onAddResume, onPickJob, onDismiss }: FirstResumeCardProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  return (
    <Card radius="card">
      <View style={{ gap: spacing[4] }}>
        <View style={styles.header}>
          <Text variant="title">{FIRST_RESUME_CARD_TITLE}</Text>
          <IconButton icon="XClose" label={FIRST_RESUME_CARD_CLOSE} onPress={onDismiss} />
        </View>
        <FirstResumeSteps stage={stage} />
        {stage === 'add-resume' ? (
          <Button label="Add my resume" block onPress={onAddResume} />
        ) : (
          <Button label="Pick a job" block onPress={onPickJob} />
        )}
      </View>
    </Card>
  );
}

const useStyles = scaledSheet(() => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));
