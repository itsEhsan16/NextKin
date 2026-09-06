import { useLocalSearchParams } from 'expo-router';

import { AssistantScreen } from '@/features/assistant';

export default function AssistantRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <AssistantScreen resumeId={resumeId} />;
}
