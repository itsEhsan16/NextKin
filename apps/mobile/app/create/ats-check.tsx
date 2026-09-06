import { useLocalSearchParams } from 'expo-router';

import { AtsCheckScreen } from '@/features/create';

export default function AtsCheckRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <AtsCheckScreen resumeId={resumeId} />;
}
