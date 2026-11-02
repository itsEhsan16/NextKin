'use client';

import {
  atsBandFor,
  ATS_BAND_LABEL,
  type AtsCheckResult,
  type Generation,
  type Job,
} from '@nextkin/shared/models';
import { useJdComparison, useResume } from '@nextkin/shared/queries';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import type { Route } from 'next';
import Link from 'next/link';

import { JobLogoTile } from '@/features/tailor/flow/EntityRow';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { iconButton } from '@/ui/iconButton';
import { PersonIcon, StarIcon } from '@/ui/icons';
import { ChevronRight } from '@/ui/lineIcons';
import {
  ProfileSkillsIllustration,
  SettingsLightbulbIllustration,
  SparkleIllustration,
} from '@/ui/illustrations';
import { ScoreRing } from '@/ui/ScoreRing';

import { backButton, ColumnHead, primaryButton, stepCard } from '../jobFlow/FlowChrome';

const RING = { strong: 'success', good: 'success', fair: 'warning', weak: 'danger' } as const;
const PILL = {
  strong: 'bg-success-surface text-success-text',
  good: 'bg-success-surface text-success-text',
  fair: 'bg-warning-50 text-warning-text',
  weak: 'bg-danger-50 text-danger-text',
} as const;
const ORDER = ['keywords', 'timeline', 'sections', 'formatting', 'achievements'] as const;

/**
 * ATS 03 (863:277): your ATS score for the job — the ring with its band and what it rests on, the
 * score by part, the missing keywords (add them only if they're true), and what would raise it,
 * ranked by worth, with who can do each. The parts and the ranked fixes are the same engine run as
 * the tailor flow's comparison of this resume with this job; "Fix it for this job" opens it.
 */
export function AtsResult({
  generation,
  result,
  job,
  fixHref,
  againHref,
  backHref,
}: {
  generation: Generation;
  result: AtsCheckResult;
  job: Job;
  fixHref: Route | undefined;
  againHref: Route;
  backHref: Route;
}) {
  const resumeId = generation.sourceResumeId ?? generation.resumeId ?? '';
  const resume = useResume(resumeId);
  const comparison = useJdComparison(resumeId, generation.jdId ?? '');
  const plan = comparison.data?.plan;
  const band = atsBandFor(result.score);
  const keywords =
    comparison.data?.keywords.filter((k) => !k.onResume) ??
    result.missing.map((label) => ({ label, onResume: false, source: 'description' as const }));
  const steps: PlanStep[] = plan?.steps.slice(0, 4) ?? [];
  const match = comparison.data?.jobMatch;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className={cn(
            iconButton,
            'size-9 rounded-full border border-border-default bg-surface-card',
          )}
        >
          <ChevronRight aria-hidden className="size-4.5 rotate-180 text-text-primary" />
        </Link>
        <JobLogoTile job={job} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption-m text-text-tertiary">
            ATS check{resume.data ? ` · ${resume.data.title}` : ''}
          </p>
          <h1 className="truncate text-title-l font-bold text-text-primary">
            Your ATS score for {job.company ? `${job.title} · ${job.company}` : job.title}
          </h1>
        </div>
        <Link href={againHref} className={backButton}>
          Check another
        </Link>
        {fixHref && (
          <Link href={fixHref} className={primaryButton}>
            <SparkleIllustration aria-hidden className="h-auto w-4" />
            Fix it for this job
          </Link>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <section
          aria-label="Your score"
          className={cn(stepCard, 'flex flex-col items-center gap-4 p-6')}
        >
          <ScoreRing
            score={result.score}
            label="Out of 10"
            name="ATS score"
            size={152}
            outOf10
            large
            showLabel
            sweep
            tone={RING[band]}
          />
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-caption-m font-semibold', PILL[band])}
          >
            ATS score · {ATS_BAND_LABEL[band]}
          </span>
          <p className="text-center text-body-l text-text-secondary">
            {match
              ? `Your resume shows ${match.matched} of this job’s ${match.total} key keywords.`
              : result.missing.length === 0
                ? 'Every keyword the job asks for is on your resume.'
                : `${result.missing.length} of the job’s keywords aren’t on your resume yet.`}
          </p>
          {plan && (
            <ul
              aria-label="Your score by part"
              className="flex w-full flex-col gap-3.5 rounded-md bg-neutral-50 p-4"
            >
              {ORDER.map((key) => plan.parts.find((p) => p.key === key))
                .filter((p) => p !== undefined)
                .map((part) => {
                  const full = part.max > 0 && part.got >= part.max - 0.05;
                  return (
                    <li key={part.key} className="flex flex-col gap-1.5">
                      <p className="flex justify-between text-body-l">
                        <span className="font-medium text-text-primary">{part.label}</span>
                        <span
                          className={cn(
                            'tabular-nums',
                            full ? 'text-success-600' : 'text-text-secondary',
                          )}
                        >
                          {part.got.toFixed(1)} / {part.max.toFixed(1)}
                        </span>
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            full ? 'bg-success-600' : 'bg-brand-600',
                          )}
                          style={{
                            width: `${part.max > 0 ? Math.min(100, (part.got / part.max) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5 lg:col-span-2">
          {keywords.length > 0 && (
            <section className={cn(stepCard, 'flex flex-col gap-4 px-6 py-5')}>
              <ColumnHead
                art={<ProfileSkillsIllustration className="h-auto w-11" />}
                title="Missing keywords"
                subtitle="Add them only if they’re true"
              />
              <ul className="flex flex-wrap gap-2.5">
                {keywords.map((k) => (
                  <li
                    key={k.label}
                    className="flex items-baseline gap-2 rounded-full border border-border-default px-3.5 py-1.5 text-body-l text-text-primary"
                  >
                    {k.label}
                    <span
                      className={cn(
                        'text-caption-m font-semibold',
                        k.source === 'required' ? 'text-danger-text' : 'text-text-tertiary',
                      )}
                    >
                      {k.source === 'required' ? 'Required' : 'Preferred'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className={cn(stepCard, 'flex flex-col gap-4 px-6 py-5')}>
            <ColumnHead
              art={<SettingsLightbulbIllustration className="h-auto w-11" />}
              title="What would raise it"
              subtitle="Ranked by what each fix is worth"
            />
            <ul className="flex flex-col gap-3">
              {steps.length > 0
                ? steps.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-4 rounded-md bg-neutral-50 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-body-l font-bold text-text-primary">{s.title}</p>
                        <p className="truncate text-body-m text-text-secondary">
                          {s.need ? `“${s.need}”` : s.have}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
                          s.who === 'ai'
                            ? 'bg-brand-50 text-text-brand'
                            : 'bg-warning-50 text-warning-text',
                        )}
                      >
                        {s.who === 'ai' ? (
                          <StarIcon aria-hidden className="size-3" />
                        ) : (
                          <PersonIcon aria-hidden className="size-3" />
                        )}
                        {s.who === 'ai' ? 'AI does it' : 'Only if you have it'}
                      </span>
                      <span className="w-12 shrink-0 text-right text-title-l font-bold tabular-nums text-success-600">
                        {s.worth !== null ? `+${s.worth.toFixed(1)}` : '—'}
                      </span>
                    </li>
                  ))
                : result.fixes.map((f) => (
                    <li key={f.key} className="rounded-md bg-neutral-50 px-4 py-3">
                      <p className="text-body-l font-bold text-text-primary">{f.title}</p>
                      <p className="text-body-m text-text-secondary">{f.detail}</p>
                    </li>
                  ))}
            </ul>
          </section>
          <Callout>“Fix it for this job” opens the comparison. Your file isn’t changed.</Callout>
        </div>
      </div>
    </div>
  );
}
