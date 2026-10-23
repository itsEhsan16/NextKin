import { EducationStepScreen } from '@/features/onboarding/screens/EducationStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingEducationPage() {
  return (
    <PageTransition>
      <EducationStepScreen />
    </PageTransition>
  );
}
