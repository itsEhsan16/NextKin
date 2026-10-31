import type { Job } from '../models/job';

/**
 * Where a candidate applies: the employer's application page, else the page the job came from,
 * else its site. NextKin submits nothing, so "Apply" always means going there. Null for a job
 * pasted in with no page behind it.
 */
export function applyPageOf(job: Job): string | null {
  const target = job.applyUrl || job.sourceUrl || job.companyWebsite;
  if (!target) return null;
  return /^https?:\/\//.test(target) ? target : `https://${target}`;
}
