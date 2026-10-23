import { SkillsStepScreen } from '@/features/onboarding/screens/SkillsStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingSkillsPage() {
  return (
    <PageTransition>
      <SkillsStepScreen />
    </PageTransition>
  );
}
