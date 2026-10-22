import { NameStepScreen } from '@/features/onboarding/screens/NameStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingNamePage() {
  return (
    <PageTransition>
      <NameStepScreen />
    </PageTransition>
  );
}
