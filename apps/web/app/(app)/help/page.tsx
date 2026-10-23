import { HelpScreen } from '@/features/help/screens/HelpScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Help & support (563:4), which replaced its coming-soon page (`toreview.md` §94). */
export default function HelpPage() {
  return (
    <PageTransition>
      <HelpScreen />
    </PageTransition>
  );
}
