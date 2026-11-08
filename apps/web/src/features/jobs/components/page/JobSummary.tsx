import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  MATCH_BAND_LABEL,
  matchBasisCaption,
  REMOTE_TYPE_LABEL,
  type Job,
  type Profile,
} from '@nextkin/shared/models';
import type { JobFactsKnown } from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { formatSalaryBand } from '@/lib/format';
import { CompanyLogo } from '@/ui/CompanyLogo';
import {
  ApartmentIcon,
  BriefcaseIcon,
  ChevronRightIcon,
  ClockIcon,
  LocationOutlineIcon,
  PaymentsIcon,
  PersonIcon,
} from '@/ui/icons';

import { experienceLabel } from '../../experienceRange';
import { matchRows, shortPlace } from '../../jobPageLibrary';
import { MATCH_TONE } from '../../matchTone';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** The facts a job description stated; every one of a listing's. */
const ALL_KNOWN: JobFactsKnown = {
  company: true,
  location: true,
  remote: true,
  employmentType: true,
  experienceLevel: true,
  years: true,
};

/**
 * The job's facts (730:44-70), two columns: where, how, pay; type, years, level. A listing's
 * years fall back to its level's band; a job description shows only what it stated.
 */
function Facts({ job, known }: { job: Job; known?: JobFactsKnown }) {
  const k = known ?? ALL_KNOWN;
  const facts: { key: string; Icon: Glyph; label: string; strong?: boolean; on: boolean }[] = [
    { key: 'location', Icon: LocationOutlineIcon, label: job.location, on: k.location },
    {
      key: 'type',
      Icon: BriefcaseIcon,
      label: EMPLOYMENT_TYPE_LABEL[job.employmentType],
      on: k.employmentType,
    },
    { key: 'remote', Icon: ApartmentIcon, label: REMOTE_TYPE_LABEL[job.remote], on: k.remote },
    { key: 'years', Icon: ClockIcon, label: experienceLabel(job), on: known ? k.years : true },
    ...(job.salary
      ? [
          {
            key: 'pay',
            Icon: PaymentsIcon,
            label: formatSalaryBand(job.salary),
            strong: true,
            on: true,
          },
        ]
      : []),
    {
      key: 'level',
      Icon: PersonIcon,
      label: `${EXPERIENCE_LEVEL_LABEL[job.experienceLevel]} level`,
      on: k.experienceLevel,
    },
  ].filter((fact) => fact.on && fact.label);
  if (facts.length === 0) return null;
  return (
    <ul className="mt-3 grid max-w-[380px] grid-cols-2 gap-x-6 gap-y-2">
      {facts.map(({ key, Icon, label, strong }) => (
        <li
          key={key}
          className={cn(
            'flex items-center gap-2 text-body-m',
            strong ? 'font-semibold text-text-primary' : 'text-text-secondary',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The match card (730:73): the score, its band and how it breaks down for this user. "How we
 * match" opens Help's answer on how the percentage is worked out.
 */
function MatchCard({
  job,
  profile,
  known,
}: {
  job: Job;
  profile: Profile | undefined;
  known?: JobFactsKnown;
}) {
  if (job.matchScore == null || !job.matchBand) return null;
  const tone = MATCH_TONE[job.matchBand];
  return (
    <section
      aria-label="How well you match"
      className="w-full shrink-0 rounded-md bg-neutral-50 p-5 md:w-[220px]"
    >
      <div className="flex items-baseline gap-1">
        <span className="text-display-l text-text-primary">{Math.round(job.matchScore * 100)}</span>
        <span className="text-body-l font-semibold text-text-primary">%</span>
        <span className={cn('ml-auto text-micro font-bold uppercase tracking-wide', tone.text)}>
          {MATCH_BAND_LABEL[job.matchBand]}
        </span>
      </div>
      {job.matchBasis && (
        <p className="mt-1 text-caption-m text-text-tertiary">
          {matchBasisCaption(job.matchBasis)}
        </p>
      )}
      <dl className="mt-3 flex flex-col gap-1.5">
        {matchRows(job, profile, known).map((row) => (
          <div key={row.label} className="flex items-center justify-between text-body-s">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="font-semibold text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/help"
        className="mt-3 inline-flex items-center gap-1 rounded-sm text-body-s font-medium text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        How we match
        <ChevronRightIcon aria-hidden className="size-3" />
      </Link>
    </section>
  );
}

/**
 * The top of the job (730:38-118): the employer and where it is based, the title and the facts,
 * the match card beside them, then what the team does and the tags — industries in grey, perks
 * in green.
 */
export function JobSummary({
  job,
  profile,
  known,
}: {
  job: Job;
  profile: Profile | undefined;
  /** A job description's page: which facts it stated (toreview §110). */
  known?: JobFactsKnown;
}) {
  const hq = shortPlace(job.companyHeadquarters);
  const company = job.company.trim();
  return (
    <div className="px-8 pb-5 pt-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          {/* A div: the logo's letter tile (a JD has no logo) is itself a block. */}
          {company && (
            <div className="mb-3 flex items-center gap-2 text-body-m text-text-primary">
              <CompanyLogo company={company} logoUrl={job.companyLogoUrl} variant="inline" />
              <span className="font-semibold">{company}</span>
              {hq && <span className="text-body-s text-text-tertiary">· {hq}</span>}
            </div>
          )}
          <h1 className="text-display-l text-text-primary">{job.title}</h1>
          <Facts job={job} {...(known ? { known } : {})} />
        </div>
        <MatchCard job={job} profile={profile} {...(known ? { known } : {})} />
      </div>

      {job.description && (
        <p className="mt-5 text-body-m text-text-secondary">
          {company && <span className="font-semibold text-text-primary">{company}</span>}{' '}
          {company && job.description.startsWith(company)
            ? job.description.slice(company.length).trimStart()
            : job.description}
        </p>
      )}

      {Boolean(job.industries?.length || job.perks?.length) && (
        <ul aria-label="About this job" className="mt-3 flex flex-wrap gap-2">
          {job.industries?.map((tag) => (
            <li
              key={tag}
              className="rounded-sm bg-neutral-100 px-2 py-1 text-caption-m font-medium text-text-secondary"
            >
              {tag}
            </li>
          ))}
          {job.perks?.map((perk) => (
            <li
              key={perk}
              className="flex items-center gap-1 rounded-sm bg-success-surface px-2 py-1 text-caption-m font-medium text-success-text"
            >
              <span aria-hidden>✓</span>
              {perk}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
