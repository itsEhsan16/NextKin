import { UploadStepScreen } from '@/features/onboarding/screens/UploadStepScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function OnboardingUploadPage() {
  return (
    <PageTransition>
      <UploadStepScreen />
    </PageTransition>
  );
}
