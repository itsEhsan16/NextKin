import { useLocalSearchParams } from 'expo-router';

import { ApplicationScreen } from '@/features/jobs';

export default function ApplicationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ApplicationScreen id={id ?? ''} />;
}
