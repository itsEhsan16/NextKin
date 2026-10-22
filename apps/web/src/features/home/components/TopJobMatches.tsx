'use client';

import Link from 'next/link';
import type { Route } from 'next';

import { matchBasisCaption, type Job } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { formatApplicants, formatShortAge } from '@/lib/format';
import { Card } from '@/ui/Card';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { iconButton } from '@/ui/iconButton';
import { ChevronRightIcon } from '@/ui/icons';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { LogoAdobeIllustration, LogoGoogleIllustration } from '@/ui/illustrations';

import { jobPageHref } from '@/features/jobs/jobPageLibrary';

import { useJobCarousel } from './useJobCarousel';
import { pressable } from '@/ui/pressable';

export type TopJobMatchesProps = {
  jobs?: Job[];
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
};

/**
 * One character per card, by position (286:358, 286:495), then the owner's CH1–CH9 (705:1268 …
 * 705:2338) for the cards that slide in after them (`toreview.md` §101). Served rather than
 * inlined — 46–123KB each, which is the `public/illustrations` rule in the README. The first two
 * keep their board placement; the rest stand on the card's floor at the same height.
 */
const CHARACTERS: readonly { src: string; className: string }[] = [
  { src: '/illustrations/job-seeker-1.svg', className: 'right-0.5 top-[26px] h-[139px] w-[124px]' },
  {
    src: '/illustrations/job-seeker-2.svg',
    className: 'right-[5px] top-[23px] h-[138px] w-[119px]',
  },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    src: `/illustrations/job-seeker-ch${n}.svg`,
    className: 'bottom-0 right-1.5 h-[136px] w-auto',
  })),
];

/** Two cards side by side from `xl`, one below it; the step is a card and the gap between. */
const PER_VIEW = '[--per:1] xl:[--per:2]';

/**
 * "Top Job Matches" (286:324). The best picks, two at a time; every few seconds the next one slides
 * in from the right and the first slides out, round and round. It holds still under a pointer or
 * focus, and under reduced motion it never moves by itself — the arrows step it either way.
 */
export function TopJobMatches({ jobs, status, onRetry }: TopJobMatchesProps) {
  // What replaces the skeleton fades in; content already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');
  const picks = jobs ?? [];
  const carousel = useJobCarousel(picks.length);

  return (
    <Card className="min-w-0 flex-1 p-4">
      <SectionHeader
        title="Top Job Matches"
        actionHref={picks.length ? ('/jobs' as Route) : undefined}
        controls={
          carousel.moves && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous matches"
                onClick={carousel.previous}
                className={cn(iconButton, 'rounded-full text-text-tertiary')}
              >
                <ChevronRightIcon aria-hidden className="size-3.5 rotate-180" />
              </button>
              <button
                type="button"
                aria-label="Next matches"
                onClick={carousel.next}
                className={cn(iconButton, 'rounded-full text-text-tertiary')}
              >
                <ChevronRightIcon aria-hidden className="size-3.5" />
              </button>
            </span>
          )
        }
      />

      {status === 'pending' && (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <Skeleton className="h-[164px] rounded-md" />
          <Skeleton className="h-[164px] rounded-md" />
        </div>
      )}

      {status === 'error' && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          tone="danger"
          title="Couldn't load matches"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      )}

      {status === 'success' && picks.length === 0 && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          title="No matches yet"
          message="Complete your profile and we'll start matching you to roles."
        />
      )}

      {status === 'success' && picks.length > 0 && (
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Top job matches"
          className={cn('mt-3 overflow-hidden', reveal && 'animate-reveal')}
          {...carousel.holdProps}
        >
          <ul
            className={cn(
              'flex gap-3',
              PER_VIEW,
              carousel.animate && 'transition-transform duration-slide ease-standard',
            )}
            style={{
              transform: `translateX(calc(${-carousel.index} * (100% + 0.75rem) / var(--per)))`,
            }}
            onTransitionEnd={carousel.settle}
          >
            {carousel.order.map((slot, position) => {
              const job = picks[slot];
              if (!job) return null;
              const clone = position >= picks.length;
              return (
                <li
                  key={`${job.id}-${position}`}
                  // The two copies at the end let the loop wrap without sliding back; they are
                  // never read or tabbed to.
                  inert={clone}
                  aria-hidden={clone || undefined}
                  className="w-full shrink-0 xl:w-[calc((100%-0.75rem)/2)]"
                >
                  <JobMatchCard job={job} slot={slot} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** The board's two logos are drawn for it; any other company takes the shared logo mark. */
function Logo({ job }: { job: Job }) {
  if (job.company === 'Google') return <LogoGoogleIllustration className="size-7 shrink-0" />;
  if (job.company === 'Adobe') return <LogoAdobeIllustration className="size-7 shrink-0" />;
  // In the board's 28px slot, so a card's row sits where Google's and Adobe's do.
  return (
    <span className="flex size-7 shrink-0 items-center justify-center *:size-7">
      <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="plain" />
    </span>
  );
}

function JobMatchCard({ job, slot }: { job: Job; slot: number }) {
  const match = job.matchScore != null ? Math.round(job.matchScore * 100) : undefined;
  const character = CHARACTERS[slot % CHARACTERS.length];

  return (
    <Link
      href={jobPageHref(job.id)}
      className={cn(
        pressable,
        'relative flex h-[164px] flex-col overflow-hidden rounded-md border border-border-subtle px-3.5 hover:border-border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
      )}
    >
      {/* Behind the copy and clipped by the card, exactly as the board stacks it. */}
      {character && (
        /* eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG art, nothing to optimise */
        <img
          src={character.src}
          alt=""
          aria-hidden
          loading={slot < 2 ? 'eager' : 'lazy'}
          className={`pointer-events-none absolute ${character.className}`}
        />
      )}

      <div className="relative flex items-center gap-9 pt-3">
        <Logo job={job} />
        {match != null && (
          <span className="rounded-full bg-success-surface px-2.5 py-1 text-caption-m font-semibold text-success-text">
            {match}% Match
          </span>
        )}
      </div>

      <h3 className="relative mt-2.5 max-w-[136px] text-title-l text-text-primary">{job.title}</h3>
      <p className="relative mt-0.5 text-body-s font-medium text-text-tertiary">{job.company}</p>
      {/* The basis behind the number (G16; toreview §105.18). */}
      {match != null && job.matchBasis && (
        <p className="relative mt-0.5 truncate text-caption-m text-text-tertiary">
          {matchBasisCaption(job.matchBasis)}
        </p>
      )}

      <div className="relative mt-2.5 flex flex-wrap gap-1.5">
        <Chip>{job.employmentType === 'full_time' ? 'Full-time' : job.employmentType}</Chip>
        <Chip>{formatShortAge(job.postedAt)}</Chip>
      </div>

      {job.applicantsCount != null && (
        <div className="relative mb-3.5 mt-auto flex items-center gap-2">
          <ApplicantStack />
          <span className="text-caption-m font-medium text-text-tertiary">
            {formatApplicants(job.applicantsCount)}
          </span>
        </div>
      )}
    </Link>
  );
}

/** Three overlapping 20px avatars (286:348) — decoration for the applicant count beside them. */
function ApplicantStack() {
  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {[0, 1, 2].map((i) => (
        /* eslint-disable-next-line @next/next/no-img-element -- fixed 20px decoration, nothing to optimise */
        <img
          key={i}
          src="/avatars/applicant.png"
          alt=""
          width={20}
          height={20}
          className="size-5 rounded-full border-2 border-neutral-0 object-cover not-first:-ml-1.5"
        />
      ))}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    /* 22px — the board's 25px chip (286:343) at the compact density. */
    <span className="rounded-sm bg-neutral-100 px-2.5 py-[3px] text-caption-m font-medium text-text-secondary">
      {children}
    </span>
  );
}
