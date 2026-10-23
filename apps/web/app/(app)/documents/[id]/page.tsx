import { DocumentViewerScreen } from '@/features/documents/screens/DocumentViewerScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Where a document's "Open" goes (286:2232): the viewer, drawn as 563:1377 (`toreview.md` §95). */
export default async function DocumentViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageTransition>
      <DocumentViewerScreen id={id} />
    </PageTransition>
  );
}
