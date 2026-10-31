import { useLocalSearchParams } from 'expo-router';

import { BuildJobScreen } from '@/features/create';

export default function BuildJobRoute() {
  const { resumeId } = useLocalSearchParams<{ resumeId?: string }>();
  return <BuildJobScreen resumeId={resumeId} />;
}
