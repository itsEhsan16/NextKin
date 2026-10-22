import { ComingSoonScreen } from '@/features/comingSoon/ComingSoonScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function InterviewPrepPage() {
  return (
    <PageTransition>
      <ComingSoonScreen page="interview" />
    </PageTransition>
  );
}
