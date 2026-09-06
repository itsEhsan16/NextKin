import { useLocalSearchParams } from 'expo-router';

import { ExperienceFormScreen } from '@/features/profile';

/** `id` is the entry being edited, or the literal 'new' for one that does not exist yet. */
export default function ExperienceFormScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExperienceFormScreen id={id ?? 'new'} />;
}
