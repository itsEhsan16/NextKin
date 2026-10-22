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
import { cardSurface } from '@/ui/Card';

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
export function SuggestionsCard() {
  return (
    <section aria-labelledby="profile-suggestions" className={cn(cardSurface, 'p-5')}>
      <div className="flex items-start gap-3">
        <NavAiAssistantIllustration aria-hidden className="mt-0.5 h-auto w-8 shrink-0" />
        <div className="min-w-0">
          <h2 id="profile-suggestions" className="text-h2 text-text-primary">
            AI profile suggestions
          </h2>
          <p className="mt-0.5 text-body-m font-semibold text-text-tertiary">
            Get personalized suggestions to strengthen your profile.
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col">
        {SUGGESTIONS.map(({ id, label }) => {
          const Art = ART[id];
          return (
            <li key={id}>
              <Link
                href={ASSISTANT}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-body-l font-semibold text-text-primary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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

      <Link href={ASSISTANT} className={cn(cardFooterAction, 'mt-3')}>
        View all suggestions
        <ArrowRightIcon className="size-4" />
      </Link>
    </section>
  );
}

/** "Ready for more opportunities?" (477:88): why the profile is worth finishing. */
export function OpportunitiesCard() {
  return (
    <section className={cn(cardSurface, 'flex items-start gap-3 p-5')}>
      <ProfilePaperPlaneIllustration aria-hidden className="mt-0.5 h-auto w-8 shrink-0" />
      <div className="min-w-0">
        <h2 className="text-h2 text-text-primary">Ready for more opportunities?</h2>
        <p className="mt-0.5 text-body-m font-semibold text-text-tertiary">
          A complete profile gets 3x more views from recruiters.
        </p>
      </div>
    </section>
  );
}
