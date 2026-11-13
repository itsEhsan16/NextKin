'use client';

import Link from 'next/link';
import type { Route } from 'next';

import type { Job } from '@nextkin/shared/models';

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
import { EmptyStateArt, LogoAdobeIllustration, LogoGoogleIllustration } from '@/ui/illustrations';

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
 * One person per card, by position (286:358, 286:495), then the owner's CH1–CH9 (705:1268 …
 * 705:2338) for the cards that slide in after them (`toreview.md` §101). Back on 2026-11-13 at the
 * owner's word: the clay objects that stood in for them now draw the empty states. Served rather
 * than inlined (46–123KB each, the `public/illustrations` rule in the README).
 */
const CHARACTERS: readonly string[] = [
  '/illustrations/job-seeker-1.svg',
  '/illustrations/job-seeker-2.svg',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `/illustrations/job-seeker-ch${n}.svg`),
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
          {/* One block per card, at the cards' own height (§196). */}
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="hidden h-48 rounded-lg xl:block" />
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
          art={<EmptyStateArt object="rocket" />}
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
  const place = job.location ? `${job.company} · ${job.location}` : job.company;

  return (
    <Link
      href={jobPageHref(job.id)}
      className={cn(
        pressable,
        // One fixed height and a slot for every piece (2026-11-13): a long title or company never
        // moves the chips or the person, and the two cards in view always line up. Sized to the
        // longest content (a two-line title and the applicants row), so a short card isn't hollow.
        'flex h-48 flex-1 gap-2 overflow-hidden rounded-lg border border-border-subtle bg-neutral-50 pl-4 transition-[background-color,box-shadow] duration-base ease-standard hover:bg-surface-card hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col py-3.5">
        {/* Logo and score, side by side. The band's own colour and word (redesign R7a, HM-03). */}
        <div className="flex h-7 items-center gap-2.5">
          <Logo job={job} />
          {match != null && <MatchBadge score={match / 100} band={job.matchBand} />}
        </div>

        {/* Title: up to two lines, then cut; company and place: one line. The whole text stays on hover. The
            score's basis line is off for now (owner, 2026-11-13: where it goes is to be decided). */}
        <h3 title={job.title} className="mt-2.5 line-clamp-2 text-title-l text-text-primary">
          {job.title}
        </h3>
        <p title={place} className="mt-0.5 truncate text-body-s font-medium text-text-tertiary">
          {place}
        </p>

        {/* The foot: always at the card's floor, whatever sits above. */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div className="flex gap-1.5 overflow-hidden">
            <Chip>{job.employmentType === 'full_time' ? 'Full-time' : job.employmentType}</Chip>
            <Chip>{formatShortAge(job.postedAt)}</Chip>
          </div>
          {job.applicantsCount != null && (
            <div className="flex h-5 items-center gap-2">
              <ApplicantStack />
              <span className="truncate text-caption-m font-medium text-text-tertiary">
                {formatApplicants(job.applicantsCount)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* The person's own column: same width, standing on the same floor, in every card. */}
      {character && (
        <div aria-hidden className="relative w-30 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG art, nothing to optimise */}
          <img
            src={character}
            alt=""
            loading={slot < 2 ? 'eager' : 'lazy'}
            draggable={false}
            className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-40 w-full object-contain object-bottom"
          />
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
    <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-card px-2.5 py-1 text-caption-m font-medium text-text-secondary">
      {children}
    </span>
  );
}
