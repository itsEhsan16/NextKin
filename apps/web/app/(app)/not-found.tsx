import { NotFoundScreen } from '@/features/system/SystemScreens';
import { PageTransition } from '@/ui/PageTransition';

export default function NotFound() {
  return (
    <PageTransition>
      <NotFoundScreen />
    </PageTransition>
  );
}
