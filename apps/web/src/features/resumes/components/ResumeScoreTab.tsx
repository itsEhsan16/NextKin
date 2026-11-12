'use client';

import {
  ATS_BAND_LABEL,
  atsSectionPassed,
  scoreLead,
  summaryAfterLead,
  type AtsBand,
  type AtsReport,
  type Resume,
} from '@nextkin/shared/models';
import { useJob, useResumeScore } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';

import { ATS_DISCLAIMER } from '@/features/create/createLibrary';
import { useReveal } from '@/lib/useReveal';
import { ScoreRing, ringToneFor } from '@/ui/ScoreRing';
import { ScoreVerdict } from '@/ui/ScoreVerdict';
import { textLink } from '@/ui/textLink';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Tag, type TagTone } from '@/ui/Tag';
import { Check } from '@/ui/lineIcons';
import { assistantHref } from '@/features/assistant/assistantHref';
import { AiCallout } from '@/ui/AiCallout';

import { resumeEditorHref } from '../resumeHref';

const ADD_JOB = '/create/build' as Route;
const RUBRIC = '/help' as Route;

const BAND_TONE: Record<AtsBand, TagTone> = {
  strong: 'success',
  good: 'brand',
  fair: 'warning',
  weak: 'danger',
};

/**
 * The ATS Score tab, which the board names (304:3317) but never opens. Verdict, reason, action
 * (redesign R6b, audit RS-34/36/37):
 * - A total only against a job (D-15). With none, no ring and no number: "Add a job to score",
 *   and the parts that need no job, each with what it rests on.
 * - Against a job, it leads with how much of what the job requires the resume shows ("5 of 7
 *   required"), then the ring with its band, then the five parts with their weights and points,
 *   and "How it's scored" beside the number, not in the footnote.
 * - Each section with an unmet check says what to do: fix it in the editor.
 */
export function ResumeScoreTab({ resume }: { resume: Resume }) {
  // A document that has never been scored has nothing to fetch: the repo misses until it is.
  const scored = resume.atsScore != null;
  const score = useResumeScore(scored ? resume.id : '');
  const job = useJob(resume.linkedJobId ?? '');
  // The ring sweeps only when the score replaces its skeleton (§196), not each time the tab opens.
  const reveal = useReveal(score.data !== undefined, resume.id);

  if (!scored) {
    return <ScoreVerdict variant="panel" kind="resume" state="no-jd" addJobHref={ADD_JOB} />;
  }

  if (score.isPending) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="size-19.5 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Data first: past the skeleton, only a load with nothing to show is an error. A failed
  // background refresh keeps what is on screen (`toreview.md` §84).
  if (score.data === undefined) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load the score"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void score.refetch()}
        className="py-8"
      />
    );
  }

  const { total, band, summary, sections, report } = score.data;
  // Against a job only (D-15): a report says whether it had one; an older score without a report
  // goes by the job the resume was written for.
  const againstJob = report ? report.jdMatch != null : resume.linkedJobId != null;
  const lead = scoreLead(report);
  const jobName = job.data
    ? `${job.data.title}${job.data.company ? ` · ${job.data.company}` : ''}`
    : undefined;

  return (
    <>
      {againstJob ? (
        <>
          {lead && (
            <p className="mb-4 text-title-l font-semibold text-text-primary">
              {lead.headline}
              <span className="ml-2 text-body-m font-normal text-text-secondary">
                {lead.detail}
                {jobName ? ` · against ${jobName}` : ''}
              </span>
            </p>
          )}
          <div className="flex items-center gap-4">
            <ScoreRing score={total} label="ATS Score" sweep={reveal} tone={ringToneFor(band)} />
            <div className="min-w-0">
              <Tag tone={BAND_TONE[band]}>{ATS_BAND_LABEL[band]}</Tag>
              <p className="mt-1.5 text-body-m text-text-secondary">
                {lead && report ? summaryAfterLead(report) || summary : summary}
              </p>
              <Link href={RUBRIC} className={cn(textLink, 'mt-1.5 inline-block text-body-s')}>
                How it’s scored
              </Link>
            </div>
          </div>
        </>
      ) : (
        <ScoreVerdict variant="panel" kind="resume" state="no-jd" addJobHref={ADD_JOB} />
      )}

      {report && <ScoreParts report={report} againstJob={againstJob} />}

      <ul className="mt-4 flex flex-col gap-3">
        {sections.map((section) => (
          <li key={section.key}>
            <div className="flex items-baseline gap-3">
              <h4 className="flex-1 text-body-m font-bold text-text-primary">{section.label}</h4>
              <span className="text-body-s text-text-tertiary">
                {atsSectionPassed(section)} of {section.items.length}
              </span>
              {/* What to do about an unmet check (RS-37): fix it where it lives. */}
              {atsSectionPassed(section) < section.items.length && (
                <Link
                  href={resumeEditorHref(resume.id)}
                  aria-label={`Fix ${section.label} in the editor`}
                  className={cn(textLink, 'text-body-s')}
                >
                  Fix
                </Link>
              )}
            </div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 text-body-s text-text-secondary"
                >
                  {item.passed ? (
                    <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-success-600" />
                  ) : (
                    <span
                      aria-hidden
                      className="mx-1 mt-1.5 size-1.5 shrink-0 rounded-full bg-warning-text"
                    />
                  )}
                  <span>
                    {item.label}
                    <span className="sr-only">{item.passed ? ', passed' : ', not yet'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-caption-m text-text-tertiary">{ATS_DISCLAIMER}</p>

      {/* The assistant answers against this resume's own checks (§7.16), so it opens with it
          attached (`toreview.md` §102). */}
      <div className="mt-4">
        <AiCallout
          title="Ask the assistant about this score"
          message="Find out what is holding it back and what to change first."
          href={assistantHref({ resume: resume.id })}
        />
      </div>
    </>
  );
}

/**
 * The five parts the total is built from (V2 §7.8), each with its weight, its points and what it
 * rests on (RS-36). Without a job, keywords are not measured and no part adds to a total.
 */
function ScoreParts({ report, againstJob }: { report: AtsReport; againstJob: boolean }) {
  const parts = againstJob
    ? report.components
    : report.components.filter((part) => part.score != null);
  if (!parts.length) return null;
  const title = againstJob ? 'What the score is built from' : 'What we can check without a job';
  return (
    <section aria-label={title} className="mt-5">
      <h4 className="text-body-m font-bold text-text-primary">{title}</h4>
      <dl className="mt-2 flex flex-col gap-2">
        {parts.map((part) => (
          <div key={part.key} className="rounded-md bg-surface-subtle px-3 py-2">
            <dt className="flex items-baseline justify-between gap-3 text-body-s font-semibold text-text-primary">
              {part.label}
              <span className="font-normal text-text-tertiary">
                {againstJob && part.points != null
                  ? `${part.points} of ${part.weight} pts`
                  : part.score != null
                    ? `${part.score} of 100`
                    : 'Not measured'}
              </span>
            </dt>
            <dd className="mt-0.5 text-body-s text-text-secondary">{part.basis}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
