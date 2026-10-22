import { DoneScreen } from '@/features/onboarding/screens/DoneScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingDonePage() {
  return (
    <PageTransition>
      <DoneScreen />
    </PageTransition>
  );
}
