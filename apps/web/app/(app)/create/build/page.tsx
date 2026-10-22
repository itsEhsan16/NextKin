import { JobFlowScreen } from '@/features/create/jobFlow/JobFlowScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Build Resume — the job first, then the resume, the comparison and what to improve (toreview §126). */
export default function BuildFlowPage() {
  return (
    <PageTransition>
      <JobFlowScreen flow="build" />
    </PageTransition>
  );
}
