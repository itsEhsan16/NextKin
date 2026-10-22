import { DocumentsScreen } from '@/features/documents/screens/DocumentsScreen';
import { PageTransition } from '@/ui/PageTransition';

export default function DocumentsPage() {
  return (
    <PageTransition>
      <DocumentsScreen />
    </PageTransition>
  );
}
