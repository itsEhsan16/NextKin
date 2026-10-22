'use client';

import { ATS_BAND_LABEL } from '@nextkin/shared/models';
import {
  SharedReportMissingError,
  useSharedReport,
  type SharedReport,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { cardSurface } from '@/ui/Card';
import { AiSparkIcon, ArrowRightIcon, CheckCircleIcon } from '@/ui/icons';
import { LogoMarkIllustration } from '@/ui/illustrations';
import { outlineButton } from '@/ui/outlineButton';
import { pageColumn } from '@/ui/pageFrame';
import { ProgressBar } from '@/ui/ProgressBar';
import { ScoreRing } from '@/ui/ScoreRing';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

/**
 * A shared ATS report, public (ImBackendImplementationPlan P11-10; V2 §4.1; SYS 05, 871:600). It
 * shows what the snapshot carries and nothing else: the score out of 10 (only with a JD, D-15),
 * how each part adds up with its basis, the job's requirements, a few suggestions and the method.
 * Copy keeps "ATS score" and never claims a result in a named employer's system (§7.8).
 */

const BAND_TONE = { strong: 'success', good: 'success', fair: 'warning', weak: 'danger' } as const;
const STATUS_LABEL: Record<string, string> = {
  met: 'Met',
  partial: 'Partly met',
  gap: 'Not shown',
};
const card = cn(cardSurface, 'rounded-xl p-5.5 shadow-card');
const tenths = (n: number) => String(Math.round(n * 10) / 10);
const dateLine = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );

export function SharedReportScreen({ token }: { token: string }) {
  const report = useSharedReport(token);
  const reveal = useReveal(report.status !== 'pending');
  const missing = report.error instanceof SharedReportMissingError;
  return (
    <div className="min-h-dvh bg-neutral-50">
      <main className={cn(pageColumn, 'flex max-w-170 flex-col gap-4 py-8')}>
        <header className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-title-l font-bold text-text-primary">
            <LogoMarkIllustration aria-hidden className="h-7 w-auto" />
            NextKin
          </span>
          <Link
            href={'/' as Route}
            className={cn(
              outlineButton,
              'h-control-md gap-2 rounded-md px-4 text-body-m font-semibold',
            )}
          >
            Make your own — free
            <ArrowRightIcon aria-hidden className="size-3.5" />
          </Link>
        </header>
        {report.status === 'pending' && (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        )}
        {report.status === 'error' && (
          <StateView
            className={cn('mt-10', reveal && 'animate-reveal')}
            tone={missing ? 'neutral' : 'danger'}
            title={missing ? 'This link no longer works' : 'Couldn’t load this report'}
            message={
              missing
                ? 'The person who shared it may have turned the link off.'
                : 'Check your connection and try again.'
            }
            {...(missing
              ? {}
              : { actionLabel: 'Try again', onAction: () => void report.refetch() })}
          />
        )}
        {report.status === 'success' && <ReportBody report={report.data} reveal={reveal} />}
      </main>
    </div>
  );
}

function ReportBody({ report, reveal }: { report: SharedReport; reveal: boolean }) {
  const job = report.targetTitle
    ? `${report.targetTitle}${report.targetCompany ? ` · ${report.targetCompany}` : ''}`
    : null;
  return (
    <div className={cn('flex flex-col gap-4', reveal && 'animate-reveal')}>
      <section className={cn(card, 'flex flex-wrap items-center gap-6')}>
        {report.total !== null && (
          <ScoreRing
            score={report.total}
            label="Out of 10"
            name="ATS score"
            size={112}
            outOf10
            large
            sweep={reveal}
            tone={report.band ? BAND_TONE[report.band] : 'success'}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <p className="text-caption-m font-bold uppercase tracking-wide text-text-brand">
            Shared ATS report
          </p>
          <h1 className="text-h2 font-bold text-text-primary">
            {job ? `A resume scored against a ${job} job` : 'A resume’s ATS report'}
          </h1>
          {report.band && (
            <span className="rounded-full bg-success-surface px-2 py-0.5 text-caption-m font-semibold text-success-text">
              ATS score · {ATS_BAND_LABEL[report.band]} match
            </span>
          )}
          <p className="text-body-m text-text-secondary">
            Shared on {dateLine(report.sharedAt)}. A snapshot: it doesn’t change if the resume does.
            Names, contact details and employers are left out.
            {report.total === null &&
              ' No overall score: it was not made against a job description.'}
          </p>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-title-l font-bold text-text-primary">How the score adds up</h2>
        <ul className="mt-3.5 flex flex-col gap-3.5">
          {report.components.map((c) => {
            // The part's share of 10: its weight is a fraction, or a percentage.
            const max = c.weight <= 1 ? c.weight * 10 : c.weight / 10;
            const full = c.score === 100;
            return (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body-m font-semibold text-text-primary">{c.label}</span>
                  <span
                    className={cn(
                      'text-body-m font-medium tabular-nums',
                      full ? 'text-success-text' : 'text-text-secondary',
                    )}
                  >
                    {c.score === null
                      ? 'Not measured'
                      : `${tenths((c.score / 100) * max)} / ${tenths(max)}`}
                  </span>
                </div>
                {c.score !== null && (
                  <ProgressBar
                    className="mt-1.5 bg-neutral-100"
                    value={c.score / 100}
                    label={`${c.label} score`}
                    sweep={reveal}
                    {...(full ? { fillClassName: 'bg-success-600' } : {})}
                  />
                )}
                <p className="mt-1 text-caption-m text-text-tertiary">{c.basis}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {report.requirements.length > 0 && (
        <section className={card}>
          <h2 className="text-title-l font-bold text-text-primary">What the job asked for</h2>
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {report.requirements.map((r) => {
              const shown = r.status !== 'gap';
              return (
                <li
                  key={r.text}
                  className={cn(
                    'flex h-control-sm items-center gap-1.5 rounded-full border px-3 text-body-m font-medium',
                    shown
                      ? 'border-success-600/30 bg-success-surface text-success-text'
                      : 'border-border-default bg-surface-card text-text-secondary',
                  )}
                >
                  {shown ? (
                    <CheckCircleIcon aria-hidden className="size-3.5" />
                  ) : (
                    <span
                      aria-hidden
                      className="size-3 rounded-full border-[1.5px] border-neutral-400"
                    />
                  )}
                  {r.text}
                  <span className="sr-only">{STATUS_LABEL[r.status] ?? r.status}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {report.suggestions.length > 0 && (
        <section className={card}>
          <h2 className="text-title-l font-bold text-text-primary">Suggestions</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {report.suggestions.map((s) => (
              <li key={s} className="flex items-start gap-2.5 text-body-m text-text-primary">
                <AiSparkIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-brand" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-caption-m text-text-tertiary">
        The ATS score is NextKin’s own measure, not a result from any company’s hiring system.
        Scored by rubric {report.method.rubric}, engine {report.method.engine}, as of{' '}
        {report.method.asOf}.
      </p>
    </div>
  );
}
