import { useLocalSearchParams } from 'expo-router';

import { NewInterviewSetScreen } from '@/features/interview';

export default function NewInterviewSetRoute() {
  const { resumeId, roleTitle } = useLocalSearchParams<{ resumeId?: string; roleTitle?: string }>();
  return <NewInterviewSetScreen resumeId={resumeId} roleTitle={roleTitle} />;
}
