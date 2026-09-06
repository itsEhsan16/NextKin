import { useLocalSearchParams } from 'expo-router';

import { CoverLetterSetupScreen } from '@/features/create';

export default function CoverLetterRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <CoverLetterSetupScreen resumeId={resumeId} />;
}
