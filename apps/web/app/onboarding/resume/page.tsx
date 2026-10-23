import { ResumeStepScreen } from '@/features/onboarding/screens/ResumeStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingResumePage() {
  return (
    <PageTransition>
      <ResumeStepScreen />
    </PageTransition>
  );
}
