'use client';

import {
  ATS_BAND_LABEL,
  atsSectionPassed,
  type AtsBand,
  type Resume,
} from '@nextkin/shared/models';
import { useResumeScore } from '@nextkin/shared/queries';

import { ATS_DISCLAIMER } from '@/features/create/createLibrary';
import { useReveal } from '@/lib/useReveal';
import { ScoreRing, ringToneFor } from '@/ui/ScoreRing';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Tag, type TagTone } from '@/ui/Tag';
import { Check } from '@/ui/lineIcons';
import { assistantHref } from '@/features/assistant/assistantHref';
import { AiCallout } from '@/ui/AiCallout';

const BAND_TONE: Record<AtsBand, TagTone> = {
  strong: 'success',
  good: 'brand',
  fair: 'warning',
  weak: 'danger',
};

/**
 * The ATS Score tab, which the board names (304:3317) but never opens: Home's score ring, the
 * band and its verdict, then the checklist the score is built from, one section at a time. V2
 * §7.8 binds every score display to saying what the number is and is not; the note at the foot
 * does that in a sentence.
 */
export function ResumeScoreTab({ resume }: { resume: Resume }) {
  // A document that has never been scored has nothing to fetch: the repo misses until it is.
  const scored = resume.atsScore != null;
  const score = useResumeScore(scored ? resume.id : '');
  // The ring sweeps only when the score replaces its skeleton (§196), not each time the tab opens.
  const reveal = useReveal(score.data !== undefined, resume.id);

  if (!scored) {
    return (
      <StateView
        title="Not scored yet"
        message="A total only means something against a job. Tailor this resume to a job to score it."
        className="py-8"
      />
    );
  }

  if (score.isPending) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="size-[78px] rounded-full" />
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

  const { total, band, summary, sections } = score.data;
  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing score={total} label="ATS Score" sweep={reveal} tone={ringToneFor(band)} />
        <div className="min-w-0">
          <Tag tone={BAND_TONE[band]}>{ATS_BAND_LABEL[band]}</Tag>
          <p className="mt-1.5 text-body-m text-text-secondary">{summary}</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {sections.map((section) => (
          <li key={section.key}>
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-body-m font-bold text-text-primary">{section.label}</h4>
              <span className="text-body-s text-text-tertiary">
                {atsSectionPassed(section)} of {section.items.length}
              </span>
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

      <p className="mt-4 text-micro text-text-tertiary">{ATS_DISCLAIMER}</p>

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
