import type { Profile, User } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { ArrowRightIcon, CheckCircleIcon } from '@/ui/icons';
import { ScoreRing } from '@/ui/ScoreRing';

import { completionItems } from '@/features/account/accountLibrary';
import { cardPad, cardSurface } from '@/ui/Card';

import type { ProfileTab } from '../profileLibrary';

/** Where each checklist item is filled in. */
const ITEM_TAB: Record<string, ProfileTab> = {
  'Add work experience': 'experience',
  'Link your LinkedIn': 'links',
};

/**
 * "Profile completion" (476:385, first drawn as Account's 307:3688): the profile's own score on Home's ring, what a complete profile
 * gets you, and the checklist. The figure is the profile's stored score, as mobile's is, and the
 * ticks are read off the account. "Complete Profile" opens the tab where the first unticked item
 * lives (`toreview.md` §102); the edit forms themselves are still to come.
 */
export function CompletionCard({
  user,
  profile,
  sweep = false,
  onOpenTab,
}: {
  user: User;
  profile: Profile;
  /** Sweep the ring in: the card arrived with its data rather than from the cache. */
  sweep?: boolean;
  /** Opens one of the profile's tabs. */
  onOpenTab: (tab: ProfileTab) => void;
}) {
  const items = completionItems(user, profile);
  const complete = items.every((item) => item.done);
  const percent = Math.round(profile.completeness * 100);

  return (
    <section aria-labelledby="profile-completion" className={cn(cardSurface, cardPad)}>
      <h2 id="profile-completion" className="text-title-l text-text-primary">
        Profile completion
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <ScoreRing
          score={percent}
          label="Profile completion"
          suffix="%"
          showLabel={false}
          size={84}
          sweep={sweep}
        />
        <div className="min-w-0">
          <p className="text-body-l font-bold text-text-primary">
            {complete ? 'All done!' : 'Almost there!'}
          </p>
          <p className="mt-0.5 text-body-s text-text-tertiary">
            {complete
              ? 'Your profile has everything job matches and AI suggestions draw on.'
              : 'Complete your profile to get better job matches and AI-powered suggestions.'}
          </p>
        </div>
      </div>

      <ul aria-label="Profile checklist" className="mt-5 flex flex-col gap-3">
        {items.map(({ label, done }) => (
          <li key={label} className="flex items-center gap-3 text-body-m text-text-secondary">
            {done ? (
              <CheckCircleIcon aria-hidden className="size-4 shrink-0 text-success-600" />
            ) : (
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full border-2 border-neutral-200"
              />
            )}
            {label}
            <span className="sr-only">{done ? ', done' : ', to do'}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={cn(
          brandButton,
          'mt-6 h-control-lg w-full gap-2 rounded-md text-body-m font-semibold',
        )}
        onClick={() => {
          const next = items.find((item) => !item.done);
          onOpenTab(next ? (ITEM_TAB[next.label] ?? 'overview') : 'overview');
        }}
      >
        Complete Profile
        <ArrowRightIcon className="size-4" />
      </button>
    </section>
  );
}
