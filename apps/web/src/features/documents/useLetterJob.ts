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

/**
 * What the callout under a document says (redesign R6d, audit DC-13). NextKin attaches nothing:
 * applying happens on the employer's site (V2 §7.13). So a letter whose job is known opens that
 * job, and anything else points to the jobs it could be sent with.
 */
export function applyCopy(
  document: CareerDocument,
  href: Route,
): { title: string; message: string } {
  const letter = document.coverLetter;
  if (letter && href !== '/jobs')
    return {
      title: 'Open the job this letter is for',
      message: `${letter.role} at ${letter.company}`,
    };
  return {
    title: 'Find a job to send it with',
    message: 'You apply on the employer’s site. Open a job to see where.',
  };
}
