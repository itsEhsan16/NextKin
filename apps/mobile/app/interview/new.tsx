import { useLocalSearchParams } from 'expo-router';

import { NewInterviewSetScreen } from '@/features/interview';

export default function NewInterviewSetRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <NewInterviewSetScreen resumeId={resumeId} />;
}
