import { useLocalSearchParams } from 'expo-router';

import { isEditableSectionKey } from '@/data/models';
import { SectionEditorScreen } from '@/features/resumes';

export default function SectionEditorRoute() {
  const { id, section } = useLocalSearchParams<{ id: string; section: string }>();
  // A hand-typed or stale deep link can name a section the document does not have. The screen
  // renders its own "no such section" state rather than the route guessing one.
  const key = section ?? '';
  return <SectionEditorScreen id={id ?? ''} section={isEditableSectionKey(key) ? key : undefined} />;
}
