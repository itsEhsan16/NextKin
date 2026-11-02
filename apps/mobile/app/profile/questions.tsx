import { useLocalSearchParams } from 'expo-router';

import { GapInterviewScreen } from '@/features/profile';

export default function GapInterviewRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <GapInterviewScreen resumeId={resumeId} />;
}
