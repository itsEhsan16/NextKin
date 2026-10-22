import { ExperienceStepScreen } from '@/features/onboarding/screens/ExperienceStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingExperiencePage() {
  return (
    <PageTransition>
      <ExperienceStepScreen />
    </PageTransition>
  );
}
