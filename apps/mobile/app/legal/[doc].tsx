import { useLocalSearchParams } from 'expo-router';

import { isLegalDocKey } from '@/data/models';
import { LegalScreen } from '@/features/support';

export default function LegalRoute() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  // Only two documents exist; anything else renders the screen's own "no such document" state
  // rather than the route inventing one.
  const key = doc ?? '';
  return <LegalScreen doc={isLegalDocKey(key) ? key : undefined} />;
}
