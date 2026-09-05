import { useLocalSearchParams } from 'expo-router';

import { ResumeEditorScreen } from '@/features/resumes';

export default function ResumeEditorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ResumeEditorScreen id={id ?? ''} />;
}
