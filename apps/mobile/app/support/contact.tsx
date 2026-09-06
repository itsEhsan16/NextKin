import { useLocalSearchParams } from 'expo-router';

import { ContactScreen } from '@/features/support';

export default function ContactRoute() {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  return <ContactScreen topic={topic} />;
}
