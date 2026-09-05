import { useLocalSearchParams } from 'expo-router';

import { AtsFixScreen } from '@/features/resumes';

export default function AtsFixRoute() {
  const { id, item } = useLocalSearchParams<{ id: string; item?: string }>();
  return <AtsFixScreen id={id ?? ''} itemId={item} />;
}
