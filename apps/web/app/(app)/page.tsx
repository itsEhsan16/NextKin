import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function HomePage() {
  return (
    <PageTransition>
      <HomeScreen />
    </PageTransition>
  );
}
