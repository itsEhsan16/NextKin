import { InsightsScreen } from '@/features/insights/screens/InsightsScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function InsightsPage() {
  return (
    <PageTransition>
      <InsightsScreen />
    </PageTransition>
  );
}
