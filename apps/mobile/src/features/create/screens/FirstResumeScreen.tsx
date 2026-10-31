import { useRouter } from 'expo-router';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { FirstResumeSteps } from '../components/FirstResumeSteps';
import { FLOW_ART, FlowHero } from '../components/FlowHero';

export const FIRST_RESUME_TITLE = 'Let’s make your first resume';
export const FIRST_RESUME_LEDE = 'Three steps, and it’s made for the job you want.';
export const FIRST_RESUME_UPLOAD = 'Upload my resume';
export const FIRST_RESUME_NONE = 'I don’t have one';
export const FIRST_RESUME_SKIP = 'Skip for now';

/**
 * What a new account sees right after sign-up (owner, 2026-11-01; toreview §145.2): upload a resume
 * or start from nothing, then on to the job. Spec-derived (V2 §7.2), from the flows' hero and the
 * run's step list. Skipping lands on Home, where the same steps wait on a card. Both ways forward
 * replace this screen: once they have chosen, Back should not ask them again.
 */
export function FirstResumeScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const skip = () => router.back();

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={FIRST_RESUME_TITLE} showTitle={false} onBack={skip} />}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      footer={
        <StickyActionBar
          secondary={{
            label: FIRST_RESUME_NONE,
            onPress: () => router.replace('/create/zero-resume'),
          }}
          primary={{
            label: FIRST_RESUME_UPLOAD,
            icon: 'UploadCloud02',
            onPress: () => router.replace({ pathname: '/create/upload', params: { next: 'job' } }),
          }}
        />
      }
    >
      <FlowHero title={FIRST_RESUME_TITLE} lede={FIRST_RESUME_LEDE} art={FLOW_ART.buildJob} />
      <Card radius="card">
        <FirstResumeSteps stage="add-resume" />
      </Card>
      <Button label={FIRST_RESUME_SKIP} variant="ghost" onPress={skip} block />
    </Screen>
  );
}
