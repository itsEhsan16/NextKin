import type { FirstResumeStage } from '@/features/create/firstResume';
import { FirstResumeSteps } from '@/features/create/components/FirstResumeSteps';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { InsightCard } from '@/ui/InsightCard';

export const FIRST_RESUME_CARD_TITLE = 'Your first resume';
export const FIRST_RESUME_CARD_CLOSE = 'Hide this card';

export type FirstResumeCardProps = {
  stage: Exclude<FirstResumeStage, 'done'>;
  onAddResume: () => void;
  onPickJob: () => void;
  onDismiss: () => void;
};

/**
 * Home's getting-started checklist (toreview.md §172): three steps to a first tailored resume and
 * one button for the next one. It leaves once a resume is made for a job; the ✕ hides it sooner.
 */
export function FirstResumeCard({ stage, onAddResume, onPickJob, onDismiss }: FirstResumeCardProps) {
  const styles = useStyles();
  const left = stage === 'add-resume' ? 3 : 2;
  return (
    <InsightCard title={FIRST_RESUME_CARD_TITLE} body={`${left} quick steps left`} icon="Rocket01">
      <IconButton
        icon="XClose"
        label={FIRST_RESUME_CARD_CLOSE}
        variant="ghost"
        iconSize="sm"
        onPress={onDismiss}
        style={styles.close}
      />
      <FirstResumeSteps stage={stage} />
      {stage === 'add-resume' ? (
        <Button label="Add my resume" size="xl" block onPress={onAddResume} />
      ) : (
        <Button label="Pick a job" size="xl" block onPress={onPickJob} />
      )}
    </InsightCard>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  close: { position: 'absolute', top: u(6), right: u(6) },
}));
