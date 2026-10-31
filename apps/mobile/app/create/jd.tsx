import { useLocalSearchParams } from 'expo-router';

import { JdPageScreen } from '@/features/create';

export default function JdPageRoute() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  return <JdPageScreen draftId={draftId ?? ''} />;
}
