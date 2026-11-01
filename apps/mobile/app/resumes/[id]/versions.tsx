import { useLocalSearchParams } from 'expo-router';

import { ResumeVersionsScreen } from '@/features/resumes';

export default function ResumeVersionsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ResumeVersionsScreen id={id ?? ''} />;
}
