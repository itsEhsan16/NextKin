import { WorkStepScreen } from '@/features/onboarding/screens/WorkStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingWorkPage() {
  return (
    <PageTransition>
      <WorkStepScreen />
    </PageTransition>
  );
}
