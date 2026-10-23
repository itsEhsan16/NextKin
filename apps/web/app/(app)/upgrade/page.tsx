import { ComingSoonScreen } from '@/features/comingSoon/ComingSoonScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function UpgradetoProPage() {
  return (
    <PageTransition>
      <ComingSoonScreen page="upgrade" />
    </PageTransition>
  );
}
