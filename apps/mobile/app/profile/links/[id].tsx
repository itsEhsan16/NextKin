import { useLocalSearchParams } from 'expo-router';

import { LinkFormScreen } from '@/features/profile';

/** `id` is the entry being edited, or the literal 'new' for one that does not exist yet. */
export default function LinkFormScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LinkFormScreen id={id ?? 'new'} />;
}
