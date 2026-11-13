'use client';

import type { Job } from '@nextkin/shared/models';
import type { ReactNode } from 'react';

import { CompanyLogo } from '@/ui/CompanyLogo';

/** "The job · Lead UX Designer · Google" beside "Your resume · …" (850:201). */
export function Entity({ lead, label, title }: { lead: ReactNode; label: string; title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 rounded-lg bg-neutral-50 py-1.5 pl-2 pr-3.5">
      {lead}
      <span className="min-w-0">
        <span className="block text-micro text-text-tertiary">{label}</span>
        <span className="block truncate text-body-l font-bold text-text-primary">{title}</span>
      </span>
    </span>
  );
}

export function JobLogoTile({ job }: { job: Job }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card">
      <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="inline" />
    </span>
  );
}

export const jobTitleOf = (job: Job): string =>
  job.company ? `${job.title} · ${job.company}` : job.title;
