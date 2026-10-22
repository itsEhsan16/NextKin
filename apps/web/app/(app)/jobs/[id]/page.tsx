import { JobPageScreen } from '@/features/jobs/screens/JobPageScreen';
import { PageTransition } from '@/ui/PageTransition';

/** A job's own page (724:2, `toreview.md` §103). */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageTransition>
      <JobPageScreen id={id} />
    </PageTransition>
  );
}
