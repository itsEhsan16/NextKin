import { useLocalSearchParams } from 'expo-router';

import { JdReviewScreen } from '@/features/create';

export default function JdReviewRoute() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  return <JdReviewScreen draftId={draftId ?? ''} />;
}
