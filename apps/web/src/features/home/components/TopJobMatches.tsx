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
import { PauseCircle, PlayCircle } from '@/ui/lineIcons';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { LogoAdobeIllustration, LogoGoogleIllustration } from '@/ui/illustrations';

import { MatchBadge } from '@/features/jobs/components/MatchBadge';
import { jobPageHref } from '@/features/jobs/jobPageLibrary';

import { useJobCarousel } from './useJobCarousel';
import { pressable } from '@/ui/pressable';

export type TopJobMatchesProps = {
  jobs?: Job[];
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
};

/**
 * One clay object per card, by position (redesign, 2026-11-13: the clay set replaced the board's
 * characters, so web and mobile share one illustration style). Each stands at the card's lower
 * right, left of which the basis caption stops (`pr-32`).
 */
const CHARACTERS: readonly { src: string; className: string }[] = Array.from(
  { length: 11 },
  (_, i) => ({
    src: `/illustrations/v2/match-${i + 1}.webp`,
    className: 'bottom-3 right-3 h-[104px] w-auto object-contain',
  }),
);

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
    <Card loading={status === 'pending'} className="min-w-0 flex-1 p-6">
      <SectionHeader
        title="Top Job Matches"
        actionHref={picks.length ? ('/jobs' as Route) : undefined}
        controls={
          carousel.moves && (
            <span className="flex items-center gap-2">
              {carousel.auto && (
                <button
                  type="button"
                  aria-label={carousel.paused ? 'Resume moving' : 'Pause moving'}
                  aria-pressed={carousel.paused}
                  onClick={carousel.togglePaused}
                  className={cn(
                    iconButton,
                    'border border-border-subtle bg-surface-card text-text-secondary shadow-card',
                  )}
                >
                  {carousel.paused ? (
                    <PlayCircle aria-hidden className="size-4" />
                  ) : (
                    <PauseCircle aria-hidden className="size-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                aria-label="Previous matches"
                onClick={carousel.previous}
                className={cn(
                  iconButton,
                  'border border-border-subtle bg-surface-card text-text-secondary shadow-card',
                )}
              >
                <ChevronRightIcon aria-hidden className="size-4 rotate-180" />
              </button>
              <button
                type="button"
                aria-label="Next matches"
                onClick={carousel.next}
                className={cn(
                  iconButton,
                  'border border-border-subtle bg-surface-card text-text-secondary shadow-card',
                )}
              >
                <ChevronRightIcon aria-hidden className="size-4" />
              </button>
            </span>
          )
        }
      />

      {status === 'pending' && (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {/* One block per card, at the cards' own minimum height (§196). */}
          <Skeleton className="h-[172px] rounded-lg" />
          <Skeleton className="hidden h-[172px] rounded-lg xl:block" />
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
          actionLabel="Complete your profile"
          actionHref={'/profile' as Route}
        />
      )}

      {status === 'success' && picks.length > 0 && (
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Top job matches"
          // Clipped sideways only, so the slides beyond the two in view stay hidden while a hovered
          // card's shadow still falls below the track.
          className={cn('mt-5 overflow-x-clip', reveal && 'animate-reveal')}
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
                  className="flex w-full shrink-0 xl:w-[calc((100%-0.75rem)/2)]"
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
        // At least the board's 172, taller when a long title or basis needs it; the two in view
        // share the taller height.
        'relative flex min-h-[172px] flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-neutral-50 px-4 pb-3.5 transition-[background-color,box-shadow] duration-base ease-standard hover:bg-surface-card hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
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
        {/* The band's own colour and word (redesign R7a, audit HM-03): it was green for every
            score. Nothing without a band, as on the Jobs list. */}
        {match != null && <MatchBadge score={match / 100} band={job.matchBand} />}
      </div>

      <h3 className="relative mt-2.5 max-w-[136px] text-title-l text-text-primary">{job.title}</h3>
      <p className="relative mt-0.5 text-body-s font-medium text-text-tertiary">{job.company}</p>
      {/* The basis behind the number (G16; toreview §105.18). */}
      {match != null && job.matchBasis && (
        // Kept left of the character (up to 124px wide) and wrapped to two lines rather than run
        // under it; the whole sentence stays on hover.
        <p
          title={matchBasisCaption(job.matchBasis)}
          className="relative mt-0.5 line-clamp-2 pr-32 text-caption-m text-text-tertiary"
        >
          {matchBasisCaption(job.matchBasis)}
        </p>
      )}

      <div className="relative mt-2.5 flex flex-wrap gap-1.5">
        <Chip>{job.employmentType === 'full_time' ? 'Full-time' : job.employmentType}</Chip>
        <Chip>{formatShortAge(job.postedAt)}</Chip>
      </div>

      {job.applicantsCount != null && (
        <div className="relative mt-auto flex items-center gap-2 pt-2.5">
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
    <span className="rounded-full bg-surface-card px-2.5 py-1 text-caption-m font-medium text-text-secondary">
      {children}
    </span>
  );
}
