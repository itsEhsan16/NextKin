import { useLocalSearchParams } from 'expo-router';

import { CertificationFormScreen } from '@/features/profile';

/** `id` is the entry being edited, or the literal 'new' for one that does not exist yet. */
export default function CertificationFormScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CertificationFormScreen id={id ?? 'new'} />;
}
