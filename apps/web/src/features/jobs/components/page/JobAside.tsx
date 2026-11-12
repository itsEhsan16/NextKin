'use client';

import type { Job } from '@nextkin/shared/models';
import { useSimilarJobs } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { formatSalaryBand } from '@/lib/format';
import { cardPad, cardSurface } from '@/ui/Card';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { ChevronRightIcon } from '@/ui/icons';
import {
  AssistantTermsIllustration,
  NavAiAssistantIllustration,
  NavInterviewPrepIllustration,
  SettingsEmailIllustration,
} from '@/ui/illustrations';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Soon, soonControl } from '@/ui/Soon';

import { jobPageHref, tailorHref } from '../../jobPageLibrary';

type Art = ComponentType<SVGProps<SVGSVGElement>>;

const TOOL =
  'flex w-full items-center gap-3 rounded-md px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function ToolBody({
  title,
  line,
  Art,
  live = false,
}: {
  title: string;
  line: string;
  Art: Art;
  /** A tool that opens something: it gets the chevron the Similar rows have (audit JB-28). */
  live?: boolean;
}) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-body-m font-semibold">{title}</span>
        <span className="block text-body-s text-text-tertiary">{line}</span>
      </span>
      <Art aria-hidden className="h-auto w-7 shrink-0" />
      {live && <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />}
    </>
  );
}

/**
 * "AI tools for this job" (730:200): tailoring opens the three-step flow (734:2), the interview
 * opens Interview Prep, and the cover letter opens its flow with this job picked (`coverTo`, else
 * this job's). It said "Coming soon" while that flow shipped (audit JB-21). A caller that sends
 * `tailorTo` (the JD page) keeps the old placeholder until it passes its own `coverTo`.
 * `onTailor` opens the "Which resume should we tailor?" dialog over the page (toreview §110); without
 * it, tailoring links to the flow (`tailorTo`, else this job's), which asks the same question.
 */
export function AiToolsCard({
  job,
  tailorTo,
  coverTo,
  onTailor,
}: {
  job: Job;
  tailorTo?: Route;
  coverTo?: Route;
  onTailor?: () => void;
}) {
  const coverHref =
    coverTo ??
    (tailorTo ? undefined : (`/create/cover-letter?job=${encodeURIComponent(job.id)}` as Route));
  const tailorClass = cn(
    pressable,
    TOOL,
    'bg-brand-50 text-text-brand hover:bg-surface-brand-strong',
  );
  const tailorBody = (
    <ToolBody
      title="Tailor your resume"
      line="Match it to this job, then download"
      Art={AssistantTermsIllustration}
      live
    />
  );
  return (
    <section aria-labelledby="job-ai-tools" className={cn(cardSurface, cardPad)}>
      <h2
        id="job-ai-tools"
        className="flex items-center gap-2 text-title-l font-semibold text-text-primary"
      >
        <NavAiAssistantIllustration aria-hidden className="h-auto w-6" />
        AI tools for this job
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        <li>
          {onTailor ? (
            <button type="button" aria-haspopup="dialog" onClick={onTailor} className={tailorClass}>
              {tailorBody}
            </button>
          ) : (
            <Link href={tailorTo ?? tailorHref(job.id)} className={tailorClass}>
              {tailorBody}
            </Link>
          )}
        </li>
        <li>
          {coverHref ? (
            <Link
              href={coverHref}
              className={cn(
                pressable,
                TOOL,
                'bg-neutral-50 text-text-primary hover:bg-neutral-100',
              )}
            >
              <ToolBody
                title="Write a cover letter"
                line="From your resume and this job"
                Art={SettingsEmailIllustration}
                live
              />
            </Link>
          ) : (
            <Soon>
              <button
                type="button"
                aria-disabled="true"
                className={cn(TOOL, 'bg-neutral-50 text-text-primary', soonControl)}
              >
                <ToolBody
                  title="Write a cover letter"
                  line="From your resume and this job"
                  Art={SettingsEmailIllustration}
                />
              </button>
            </Soon>
          )}
        </li>
        <li>
          {/* Interview Prep is still a "coming soon" page, so the tool says so here rather than
              promising "questions written for this role" and landing on a placeholder (JB-21). */}
          <Soon>
            <button
              type="button"
              aria-disabled="true"
              className={cn(TOOL, 'bg-neutral-50 text-text-primary', soonControl)}
            >
              <ToolBody
                title="Practise the interview"
                line="Questions written for this role"
                Art={NavInterviewPrepIllustration}
              />
            </button>
          </Soon>
        </li>
      </ul>
    </section>
  );
}

/** "Similar jobs" (730:236): three like this one, each opening its own page. */
export function SimilarJobsCard({ job }: { job: Job }) {
  const similar = useSimilarJobs(job.id);
  const rows = similar.data?.slice(0, 3) ?? [];
  // Optional, so it steps aside on error rather than showing a heading over nothing (JB-25).
  if ((similar.isSuccess && rows.length === 0) || similar.isError) return null;
  return (
    <section aria-labelledby="job-similar" className={cn(cardSurface, cardPad)}>
      <div className="flex items-center justify-between">
        <h2 id="job-similar" className="text-title-l font-semibold text-text-primary">
          Similar jobs
        </h2>
      </div>
      {similar.isPending ? (
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 rounded-md" />
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {rows.map((other) => (
            <li key={other.id}>
              <Link
                href={jobPageHref(other.id)}
                className={cn(
                  pressable,
                  '-mx-3 flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                )}
              >
                <CompanyLogo
                  company={other.company}
                  logoUrl={other.companyLogoUrl}
                  variant="inline"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-m font-semibold text-text-primary">
                    {other.title}
                  </span>
                  <span className="block truncate text-body-s text-text-tertiary">
                    {[
                      other.company,
                      other.remote === 'remote' ? 'Remote' : other.location.split(',')[0],
                    ]
                      .concat(other.salary ? [formatSalaryBand(other.salary)] : [])
                      .join(' · ')}
                  </span>
                </span>
                <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
