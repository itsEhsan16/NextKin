'use client';

import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  type JdFact,
  type JdStructured,
  type Job,
  type Profile,
} from '@nextkin/shared/models';
import { JD_CLOSED_NOTE, JD_CLOSED_TITLE } from '@nextkin/shared/models/jd';
import type { JobFactsKnown } from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { CompanyLogo } from '@/ui/CompanyLogo';
import {
  ApartmentIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  LocationOutlineIcon,
  PaymentsIcon,
} from '@/ui/icons';
import { AlertTriangle, InfoCircle } from '@/ui/lineIcons';

import { MatchCard } from '../../jobs/components/page/JobSummary';
import {
  WORK_MODE_LABEL,
  experienceText,
  locationText,
  payLabel,
  scheduleText,
} from '@nextkin/shared/jobs/jdLabels';
import { SourceQuotes } from './SourceQuotes';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

type QuickFact = {
  key: string;
  label: string;
  value: string;
  Icon: Glyph;
  facts: readonly (JdFact<unknown> | undefined)[];
};

const quotesOf = (facts: QuickFact['facts']) =>
  facts
    .flatMap((f) => f?.quotes ?? [])
    .filter((q, i, all) => all.findIndex((o) => o.start === q.start) === i);
const unclear = (facts: QuickFact['facts']) => facts.some((f) => f?.status === 'unclear');

/** The facts a reader looks for first, only those the posting states (toreview §153). */
function quickFacts(s: JdStructured): QuickFact[] {
  const out: (QuickFact | null)[] = [
    payLabel(s)
      ? {
          key: 'pay',
          label: 'Salary',
          value: payLabel(s)!,
          Icon: PaymentsIcon,
          facts: [s.compensation.range],
        }
      : null,
    experienceText(s.experience)
      ? {
          key: 'experience',
          label: 'Experience',
          value: experienceText(s.experience)!,
          Icon: ClockIcon,
          facts: [s.experience.minYears, s.experience.freshersOk],
        }
      : null,
    s.identity.employmentType
      ? {
          key: 'employment',
          label: 'Employment',
          value: EMPLOYMENT_TYPE_LABEL[s.identity.employmentType.value],
          Icon: BriefcaseIcon,
          facts: [s.identity.employmentType],
        }
      : null,
    s.workMode
      ? {
          key: 'mode',
          label: 'Work mode',
          value: WORK_MODE_LABEL[s.workMode.value],
          Icon: ApartmentIcon,
          facts: [s.workMode],
        }
      : null,
    locationText(s)
      ? {
          key: 'location',
          label: 'Location',
          value: locationText(s)!,
          Icon: LocationOutlineIcon,
          facts: s.locations,
        }
      : null,
    scheduleText(s)
      ? {
          key: 'schedule',
          label: 'Schedule',
          value: scheduleText(s)!,
          Icon: CalendarIcon,
          facts: s.schedule,
        }
      : null,
  ];
  return out.filter((f): f is QuickFact => f !== null);
}

/**
 * The top of a job read into its structure (toreview §153): who and what, a few chips, the match
 * card beside them, then the quick facts as a grid and anything worth knowing. Only what the
 * posting states is shown; an unclear fact says so instead of being picked for the reader.
 */
export function JdTop({
  s,
  job,
  profile,
  known,
}: {
  s: JdStructured;
  job: Job;
  profile: Profile | undefined;
  known: JobFactsKnown;
}) {
  const company = s.identity.company?.value ?? job.company;
  const chips = [
    s.identity.seniority ? `${EXPERIENCE_LEVEL_LABEL[s.identity.seniority.value]} level` : null,
    s.identity.department?.value ?? null,
    s.identity.industry?.value ?? null,
    s.identity.openings
      ? `${s.identity.openings.value} opening${s.identity.openings.value === 1 ? '' : 's'}`
      : null,
  ].filter((c): c is string => Boolean(c));
  const facts = quickFacts(s);
  const closed = s.issues.some((issue) => issue.kind === 'expired');

  return (
    <div className="px-8 pb-5 pt-6">
      {closed && (
        <Callout tone="warning" className="mb-5">
          <span className="font-semibold">{JD_CLOSED_TITLE}.</span> {JD_CLOSED_NOTE}
        </Callout>
      )}
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          {company && (
            <div className="mb-3 flex items-center gap-2 text-body-m text-text-primary">
              <CompanyLogo company={company} logoUrl={job.companyLogoUrl} variant="inline" />
              <span className="font-semibold">{company}</span>
            </div>
          )}
          <h1 className="text-display-l text-text-primary">{job.title}</h1>
          {chips.length > 0 && (
            <ul aria-label="About this role" className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-sm bg-neutral-100 px-2 py-1 text-caption-m font-medium text-text-secondary"
                >
                  {chip}
                </li>
              ))}
            </ul>
          )}
        </div>
        <MatchCard job={job} profile={profile} known={known} />
      </div>

      {facts.length > 0 && (
        <dl aria-label="Key facts" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {facts.map((f) => (
            <div key={f.key} className="flex items-start gap-3 rounded-md bg-neutral-50 px-4 py-3">
              <f.Icon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-text-tertiary" />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <dt className="basis-full text-caption-m text-text-tertiary">{f.label}</dt>
                <dd className="text-body-m font-semibold text-text-primary">{f.value}</dd>
                {unclear(f.facts) && (
                  <span className="rounded-full bg-warning-50 px-2 py-0.5 text-caption-m font-semibold text-warning-text">
                    Unclear in the listing
                  </span>
                )}
                <SourceQuotes quotes={quotesOf(f.facts)} label={f.label.toLowerCase()} />
              </div>
            </div>
          ))}
        </dl>
      )}

      <JdIssues issues={s.issues} />
    </div>
  );
}

/**
 * "Worth knowing" (toreview §153): where the posting contradicts itself or is unclear, in plain
 * words with its own quotes. Nothing is decided for the reader.
 */
function JdIssues({ issues }: { issues: JdStructured['issues'] }) {
  if (issues.length === 0) return null;
  return (
    <section aria-labelledby="jd-issues" className="mt-5 rounded-md bg-warning-50 px-5 py-4">
      <h2
        id="jd-issues"
        className="flex items-center gap-2 text-body-m font-bold text-warning-text"
      >
        <AlertTriangle aria-hidden className="size-4" />
        Worth knowing
      </h2>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {issues.map((issue) => (
          <li
            key={`${issue.field}:${issue.note}`}
            className="flex flex-wrap items-baseline gap-x-2 text-body-m text-text-primary"
          >
            <span className={cn('min-w-0', issue.kind === 'sensitive' && 'text-text-secondary')}>
              {issue.kind === 'sensitive' && (
                <InfoCircle aria-hidden className="mr-1.5 inline size-4 align-[-2px]" />
              )}
              {issue.note}
            </span>
            {issue.kind !== 'sensitive' && <SourceQuotes quotes={issue.quotes} label="this" />}
          </li>
        ))}
      </ul>
    </section>
  );
}
