import { EditorRoute } from '@/features/editor/screens/EditorRoute';
import { PageTransition } from '@/ui/PageTransition';

/** Where "Edit Resume" goes (304:3297): the resume editor (toreview §124). */
export default async function EditResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageTransition>
      <EditorRoute id={id} />
    </PageTransition>
  );
}
