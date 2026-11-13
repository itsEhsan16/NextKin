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
import { formatApplicants, formatPostedAge, formatSalaryBand } from '@/lib/format';
import { CheckCircle, XClose } from '@/ui/lineIcons';
import { CompanyLogo } from '@/ui/CompanyLogo';
import {
  ApartmentIcon,
  BriefcaseIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  LocationOutlineIcon,
  PaymentsIcon,
  PersonIcon,
} from '@/ui/icons';

import { experienceLabel } from '../../experienceRange';
import { jdTailorHref } from '@/features/jd/jdHref';

import { matchRows, shortPlace } from '../../jobPageLibrary';
import { MATCH_TONE } from '../../matchTone';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** The match card's box: beside the title from 1280, under the facts below (audit JB-20). */
const MATCH_CARD = 'w-full shrink-0 rounded-md bg-neutral-50 p-5 xl:w-[240px]';

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
export function MatchCard({
  job,
  profile,
  known,
}: {
  job: Job;
  profile: Profile | undefined;
  known?: JobFactsKnown;
}) {
  if (!job.matchBand) {
    // A job description is what a score needs (D-15), so its page says one is coming rather than
    // showing nothing (redesign R5c, audit JD-04). Never a placeholder number.
    if (!known) return null;
    return (
      <section aria-label="How well you match" className={MATCH_CARD}>
        <p className="text-body-m font-semibold text-text-primary">Not scored yet</p>
        <p className="mt-1 text-body-s text-text-secondary">
          Tailoring scores your resume against this job, requirement by requirement.
        </p>
        <Link
          href={jdTailorHref(job.id)}
          className="mt-3 inline-flex items-center gap-1 rounded-sm text-body-s font-medium text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Tailor my resume
          <ChevronRightIcon aria-hidden className="size-3" />
        </Link>
      </section>
    );
  }
  const tone = MATCH_TONE[job.matchBand];
  // A number only when the whole listing was read (P11-03); otherwise the band says it (R5b).
  const score =
    job.matchScore != null && job.matchBasis?.kind !== 'snippet' && job.matchBasis?.kind !== 'title'
      ? Math.round(job.matchScore * 100)
      : null;
  return (
    <section
      aria-label="How well you match"
      // Beside the title from 1280; under the facts below, so they keep their width (JB-20).
      className={MATCH_CARD}
    >
      <div className="flex items-center gap-2">
        {score != null && (
          <span className="flex items-baseline gap-0.5">
            <span className="text-display-l text-text-primary">{score}</span>
            <span className="text-body-l font-semibold text-text-primary">%</span>
          </span>
        )}
        {/* The band in its own colour on the honest scale (redesign R3c), never green by default. */}
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
            score != null && 'ml-auto',
            tone.surface,
            tone.text,
          )}
        >
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
          <div key={row.label} className="flex items-center gap-2 text-body-s">
            {/* Met or not, by icon as well as word (audit JB-27). */}
            {row.met ? (
              <CheckCircle aria-hidden className="size-3.5 shrink-0 text-feedback-success-icon" />
            ) : (
              <XClose aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
            )}
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="ml-auto font-semibold text-text-primary">
              {row.value}
              <span className="sr-only">{row.met ? ', met' : ', not met'}</span>
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href="/help"
        className="mt-3 inline-flex items-center gap-1 rounded-sm text-body-s font-medium text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {/* Help opens on the scoring answer (V2 §7.8: every score links its rubric). */}
        How NextKin Score works
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
  const description = known
    ? withoutTitleLine(job.description, job.title, company)
    : company && job.description.startsWith(company)
      ? job.description.slice(company.length).trimStart()
      : job.description;
  return (
    <div className="px-8 pb-5 pt-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
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
          {/* When it was posted and how many applied, under the facts (owner, 2026-11-13; they sat in
              the bar above). A listing's only: a pasted description has neither. */}
          {!known && <Freshness job={job} />}
        </div>
        <MatchCard job={job} profile={profile} {...(known ? { known } : {})} />
      </div>

      {description && (
        <p className="mt-5 text-body-m text-text-secondary">
          {/* A listing leads with its company in bold. A job description doesn't: its company is
              the row above, and its first line repeated the title (audit JD-03). */}
          {company && !known && (
            <>
              <span className="font-semibold text-text-primary">{company}</span>{' '}
            </>
          )}
          {description}
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
              className="flex items-center gap-1 rounded-sm bg-feedback-success-surface px-2 py-1 text-caption-m font-medium text-feedback-success-text"
            >
              <CheckIcon aria-hidden className="size-3" />
              {perk}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A pasted job description often opens with "{title} at {company} — {city}", which the page has
 * just shown as its heading. Drop that line (to the first full stop, dash or line break) when it
 * starts with the title, so the description starts where the description does.
 */
export function withoutTitleLine(text: string, title: string, company: string): string {
  const trimmed = text.trimStart();
  const lower = trimmed.toLowerCase();
  const heads = [title, company && `${title} at ${company}`].filter(Boolean) as string[];
  if (!heads.some((head) => lower.startsWith(head.toLowerCase()))) return text;
  const lineEnd = trimmed.search(/\n|\.\s/);
  if (lineEnd >= 0) return trimmed.slice(lineEnd + 1).trimStart();
  // One run-on line: drop "{title} at {company} — {city}" up to where the next sentence starts.
  const next = trimmed.match(/^.*?\s—\s\S+\s+(?=[A-Z])/);
  return next ? trimmed.slice(next[0].length) : text;
}

/** "Posted 2 days ago" and "80 applicants", as two soft chips. */
function Freshness({ job }: { job: Job }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption-m text-text-brand">
        Posted {formatPostedAge(job.postedAt).replace(/^1 day ago$/, 'yesterday')}
      </span>
      {job.applicantsCount != null && (
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption-m text-text-secondary">
          {formatApplicants(job.applicantsCount).replace(/\+? applied$/, ' applicants')}
        </span>
      )}
    </div>
  );
}
