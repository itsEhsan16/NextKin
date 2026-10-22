import { GoalStepScreen } from '@/features/onboarding/screens/GoalStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingGoalPage() {
  return (
    <PageTransition>
      <GoalStepScreen />
    </PageTransition>
  );
}
