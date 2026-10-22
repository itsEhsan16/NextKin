'use client';

import type { CareerDocument } from '@nextkin/shared/models';
import { useJobCatalogue } from '@nextkin/shared/queries';
import type { Route } from 'next';

import { jobHref } from '@/features/jobs/jobHref';

/**
 * Where "Use this document in your applications" goes (`toreview.md` §102): a cover letter that
 * names its job's requisition ("GOO-UX-10234") opens that job; anything else opens the Jobs list.
 */
export function useLetterJob(document: CareerDocument | undefined): Route {
  const catalogue = useJobCatalogue();
  const ref = document?.coverLetter?.jobRef;
  const job = ref ? catalogue.data?.find((item) => item.reference === ref) : undefined;
  return job ? jobHref(job.id) : ('/jobs' as Route);
}
