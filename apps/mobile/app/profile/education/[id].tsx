import { useLocalSearchParams } from 'expo-router';

import { EducationFormScreen } from '@/features/profile';

/** `id` is the entry being edited, or the literal 'new' for one that does not exist yet. */
export default function EducationFormScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EducationFormScreen id={id ?? 'new'} />;
}
