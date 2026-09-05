import { useLocalSearchParams } from 'expo-router';

import { JdReviewScreen } from '@/features/create/screens/JdReviewScreen';

export default function JdReviewRoute() {
  const { draftId, baseResumeId } = useLocalSearchParams<{
    draftId: string;
    baseResumeId?: string;
  }>();
  return <JdReviewScreen draftId={draftId ?? ''} baseResumeId={baseResumeId} />;
}
