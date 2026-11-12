import { TailorDrawer } from '@/features/tailor/screens/TailorDrawer';

/** Tailoring opened from this page: a drawer over it (redesign R5d). A hard load gets the page. */
export default async function TailorOverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TailorDrawer target={{ kind: 'job', id }} />;
}
