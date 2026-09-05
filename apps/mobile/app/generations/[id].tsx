import { useLocalSearchParams } from 'expo-router';

import { GenerationScreen } from '@/features/generations';

export default function GenerationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GenerationScreen id={id ?? ''} />;
}
