import type { Job } from '@nextkin/shared/models';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { formatPostedAge } from '@/lib/format';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { JobAiSparkleIllustration } from '@/ui/illustrations';
import { ReasonList } from '@/ui/ScoreVerdict';
import { MATCH_BAND_LABEL } from '@nextkin/shared/models';
import { cardFaceHover, cardFaceMotion } from '@/ui/pressable';

import { JobFactPills } from './JobFactPills';
import { MatchPill } from './MatchPill';
import { SaveButton } from './SaveButton';
import { reasonsFromCriteria, requiredCaption, tailorHref } from '../jobPageLibrary';

export type JobCardProps = {
  job: Job;
  selected: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
  savePending: boolean;
};

/**
 * The list card as redrawn (719:2/51/96/140/187): company and match verdict on top, the title, the
 * facts as pills, why it matches, then a footer with the posting age, "Tailor with AI" and the
 * bookmark. The skill pills moved off the card; the detail card still shows them.
 *
 * Selecting a job updates the in-page detail panel — `JobsScreen` owns the selection state — so
 * the "select" affordance is a `<button>`, but it can't be the outer element: the card also holds
 * a link and a second button, and `<button>` cannot contain either in valid HTML. Instead the
 * "select" button is an invisible full-cover sibling (`absolute inset-0`) placed *first*, with the
 * visible content painted after it.
 *
 * Paint order alone doesn't route clicks, though: the content div's opaque background covers the
 * whole card, and hit-testing follows box bounds, so it swallowed every click before the cover
 * button saw one (Playwright reported the content div "intercepts pointer events"). The content
 * is `pointer-events-none`, and only its real controls (the link and `SaveButton`) opt back in.
 *
 * The board draws the selected card with a 2px indigo border and the rest with a 1px grey one.
 * Growing the border would nudge everything inside by a pixel, so every card keeps its 1px
 * border and the selected one adds a 1px outline drawn just inside it: the same 2px of indigo,
 * with nothing moving when the selection does.
 */
export function JobCard({ job, selected, onSelect, onToggleSave, savePending }: JobCardProps) {
  const age = formatPostedAge(job.postedAt);
  const reasons = reasonsFromCriteria(job, 2);
  const basis = job.matchBand ? requiredCaption(job.matchBasis) : undefined;
  // The card's name says what a sighted reader sees on it: the job, the verdict and saved.
  const name = [
    `${job.title} at ${job.company}, ${job.location}`,
    job.matchBand && MATCH_BAND_LABEL[job.matchBand],
    job.isSaved && 'saved',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="group/card relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        // Location is part of the label, not just title+company: several fixture jobs share a
        // title and employer (two different "Senior Product Designer" roles at Stripe), which
        // would otherwise give two distinct cards the same accessible name.
        aria-label={name}
        className="peer absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />

      <div
        className={cn(
          'pointer-events-none relative flex flex-col gap-3.5 rounded-lg border bg-surface-card p-5 shadow-card',
          cardFaceMotion,
          selected
            ? 'border-border-selected outline-1 -outline-offset-2 outline-border-selected'
            : cn('border-border-subtle', cardFaceHover),
        )}
      >
        <div className="flex items-center gap-3">
          <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="card" />
          <p className="min-w-0 flex-1 truncate text-body-l font-semibold text-text-primary">
            {job.company}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <MatchPill band={job.matchBand} />
            {/* What the band rests on, on the card itself (audit JB-05). */}
            {basis && <span className="text-caption-m text-text-tertiary">{basis}</span>}
          </div>
        </div>

        <h3 className="truncate text-h2 text-text-primary">{job.title}</h3>

        <JobFactPills job={job} />

        {/* Why it matches, from the engine's criteria (audit JB-04), not editorial prose. */}
        <ReasonList reasons={reasons} />

        <div className="flex items-center gap-2 pt-0.5">
          <span className="min-w-0 flex-1 text-caption-m text-text-tertiary">
            Posted {age === 'Just now' ? 'just now' : age}
          </span>
          {/* The detail card's "Tailor your resume for this job" goes to the same place: the
              three-step tailor flow for this job (734:2, `toreview.md` §103). */}
          <Link
            href={tailorHref(job.id)}
            aria-label={`Tailor your resume for ${job.title} at ${job.company} with AI`}
            className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border-brand bg-surface-brand-strong py-1.5 pl-3 pr-3.5 text-body-m font-semibold text-text-brand transition-colors duration-press ease-standard hover:bg-border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <JobAiSparkleIllustration className="h-auto w-3.75 shrink-0" />
            Tailor with AI
          </Link>
          <SaveButton
            saved={job.isSaved}
            onToggle={onToggleSave}
            pending={savePending}
            variant="card"
          />
        </div>
      </div>
    </div>
  );
}
