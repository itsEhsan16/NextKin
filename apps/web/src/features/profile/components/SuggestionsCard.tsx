import type { Profile } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { ArrowRightIcon, ChevronRightIcon } from '@/ui/icons';
import {
  NavAiAssistantIllustration,
  ProfileInsightsIllustration,
  ProfileLinksIllustration,
  ProfileSkillsIllustration,
  ProfileTermsIllustration,
  ProfilePaperPlaneIllustration,
} from '@/ui/illustrations';

import { SUGGESTIONS, type Suggestion } from '../profileLibrary';
import { cardFooterAction } from './ProfileCard';
import { cardPad, cardSurface } from '@/ui/Card';

const ART: Record<Suggestion['id'], ComponentType<SVGProps<SVGSVGElement>>> = {
  skills: ProfileSkillsIllustration,
  summary: ProfileTermsIllustration,
  portfolio: ProfileLinksIllustration,
  impact: ProfileInsightsIllustration,
};

/** Where every suggestion leads until there is a profile-specific flow: the AI Assistant. */
const ASSISTANT = '/assistant' as Route;

/**
 * "AI profile suggestions" (477:2): four ways to strengthen the profile, each opening the AI
 * Assistant, the nearest thing web has to a guided edit, as the Jobs callouts do.
 */
export function SuggestionsCard({ profile }: { profile: Profile | undefined }) {
  // Nothing suggested that is already there (PF-03): a listed portfolio or personal site isn't
  // "to add".
  const shown = SUGGESTIONS.filter(
    ({ id }) =>
      !(
        id === 'portfolio' &&
        profile?.links.some((link) => link.kind === 'portfolio' || link.kind === 'website')
      ),
  );
  return (
    <section aria-labelledby="profile-suggestions" className={cn(cardSurface, cardPad)}>
      <div className="flex items-start gap-3">
        <NavAiAssistantIllustration aria-hidden className="mt-0.5 h-auto w-8 shrink-0" />
        <div className="min-w-0">
          <h2 id="profile-suggestions" className="text-title-l text-text-primary">
            AI profile suggestions
          </h2>
          <p className="mt-1 text-body-s text-text-tertiary">
            Get personalized suggestions to strengthen your profile.
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-0.5">
        {shown.map(({ id, label }) => {
          const Art = ART[id];
          return (
            <li key={id}>
              <Link
                href={ASSISTANT}
                className="-mx-3 flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-body-m font-semibold text-text-primary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span aria-hidden className="flex w-7 shrink-0 justify-center">
                  <Art className="h-auto max-h-5.5 w-7" />
                </span>
                <span className="min-w-0 flex-1">{label}</span>
                <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-text-secondary" />
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href={ASSISTANT} className={cardFooterAction}>
        View all suggestions
        <ArrowRightIcon className="size-4" />
      </Link>
    </section>
  );
}

/** "Ready for more opportunities?" (477:88): why the profile is worth finishing. */
export function OpportunitiesCard() {
  return (
    <section className={cn(cardSurface, cardPad, 'flex items-start gap-4')}>
      <ProfilePaperPlaneIllustration aria-hidden className="mt-0.5 h-auto w-8 shrink-0" />
      <div className="min-w-0">
        <h2 className="text-title-l text-text-primary">Ready for more opportunities?</h2>
        <p className="mt-1 text-body-s text-text-tertiary">
          {/* What the profile is used for, not an unsourced "3x more views" (PF-04): recruiter
              discovery isn't part of NextKin (V2 §6.2). */}
          Job matches and tailored resumes read your skills and experience.
        </p>
      </div>
    </section>
  );
}
