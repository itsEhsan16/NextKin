import { JobFlowScreen } from '@/features/create/jobFlow/JobFlowScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Tailor to a Job — the job first, then the resume, the comparison and what to improve (toreview §126). */
export default function TailorFlowPage() {
  return (
    <PageTransition>
      <JobFlowScreen flow="tailor" />
    </PageTransition>
  );
}
