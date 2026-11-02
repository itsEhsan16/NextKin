import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function NotificationsPage() {
  return (
    <PageTransition>
      <NotificationsScreen />
    </PageTransition>
  );
}
