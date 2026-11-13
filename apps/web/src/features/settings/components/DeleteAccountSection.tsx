import { useDeleteAccount } from '@nextkin/shared/queries';
import { useId, useState, type ComponentType, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { SIGN_IN } from '@/lib/dataSource';
import { signOut } from '@/lib/signOut';
import { cardPad, cardSurface } from '@/ui/Card';
import { showToast } from '@/lib/toast';
import { fieldBox } from '@/ui/fieldBox';
import { InfoCircleIcon } from '@/ui/icons';
import {
  NavSettingsIllustration,
  ProfileExperienceIllustration,
  ProfileLinksIllustration,
  ProfileTermsIllustration,
  SettingsMatchScoreIllustration,
  SettingsResumesIllustration,
} from '@/ui/illustrations';
import { pressable } from '@/ui/pressable';
import { StableLabel } from '@/ui/StableLabel';
import { Soon, soonControl } from '@/ui/Soon';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/** What typing unlocks the button (467:628). */
const CONFIRM_WORD = 'DELETE';

/** "What will be deleted?" (467:490), in the board's order, each with its duotone glyph. */
const LOSSES: readonly {
  title: string;
  line: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    title: 'Your profile information',
    line: 'Name, email, bio, and preferences',
    Art: ProfileTermsIllustration,
  },
  {
    title: 'Your resumes',
    line: 'All uploaded and created resumes',
    Art: SettingsResumesIllustration,
  },
  {
    title: 'Your applications',
    line: 'All job applications and saved jobs',
    Art: ProfileExperienceIllustration,
  },
  {
    title: 'Your insights and activity',
    line: 'Analytics, recommendations, and history',
    Art: SettingsMatchScoreIllustration,
  },
  {
    title: 'Settings and preferences',
    line: 'App settings, notifications, and data',
    Art: NavSettingsIllustration,
  },
  {
    title: 'Connected accounts',
    line: 'Google sign-in will be unlinked',
    Art: ProfileLinksIllustration,
  },
];

/** The board's red warning triangle (467:481), drawn in the danger ink. */
function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 27" aria-hidden className={className}>
      <path
        d="M13.27 1a2 2 0 0 1 3.46 0l12.99 22.5A2 2 0 0 1 27.99 26.5H2.01A2 2 0 0 1 .28 23.5z"
        fill="currentColor"
      />
      <g className="text-neutral-0">
        <path d="M15 8.5v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="15" cy="21" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * Settings → Delete account (467:3), which replaced its coming-soon panel: what can't be undone,
 * what goes with the account, the way to step away instead, and a typed "DELETE" before the red
 * button wakes.
 *
 * The delete runs through the shared layer's `useDeleteAccount`, then signs this browser out to the
 * sign-in screen. Deactivating
 * has no endpoint in the spec or the data layer, so that button is inert (`toreview.md` §92).
 */
export function DeleteAccountSection({ onCancel }: { onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  const remove = useDeleteAccount();
  const inputId = useId();
  const hintId = useId();
  const confirmed = typed.trim() === CONFIRM_WORD;

  return (
    <section aria-label="Delete account" className={cn(cardSurface, cardPad, 'flex flex-col')}>
      <div role="note" className="flex items-center gap-4 rounded-md bg-danger-50 px-4 py-3">
        <WarningGlyph className="h-auto w-6 shrink-0 text-danger-600" />
        <div className="min-w-0">
          <p className="text-body-l font-semibold text-danger-text">This action cannot be undone</p>
          <p className="mt-0.5 text-body-m text-text-primary">
            Deleting your account will permanently remove your data, and you will lose access to all
            features, including your resumes, applications, insights, and settings.
          </p>
        </div>
      </div>

      <h2 className="mt-6 text-title-l text-text-primary">What will be deleted?</h2>
      <p className="mt-0.5 text-body-s text-text-tertiary">
        The following data will be permanently removed from our systems:
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {LOSSES.map(({ title, line, Art }) => (
          <li
            key={title}
            className="flex min-w-0 items-center gap-3 rounded-md bg-neutral-50 px-4 py-3"
          >
            <span aria-hidden className="flex w-8 shrink-0 justify-center">
              <Art className="h-auto max-h-7 w-8" />
            </span>
            <span className="min-w-0">
              <span className="block text-body-m font-semibold text-text-primary">{title}</span>
              <span className="block text-body-s text-text-tertiary">{line}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-md bg-surface-brand px-4 py-3.5">
        <InfoCircleIcon aria-hidden className="size-6 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1 basis-80">
          <p className="text-body-m font-semibold text-brand-700">Want to take a break instead?</p>
          <p className="mt-0.5 text-body-s text-text-secondary">
            You can deactivate your account temporarily and come back anytime. Your data will be
            safely stored.
          </p>
        </div>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(
              soonControl,
              BUTTON_VARIANT['brand-secondary'],
              'h-control-md shrink-0 rounded-md px-5 text-body-m',
            )}
          >
            Deactivate account
          </button>
        </Soon>
      </div>

      <label htmlFor={inputId} className="mt-6 text-title-l text-text-primary">
        Confirm deletion
      </label>
      <p id={hintId} className="mt-0.5 text-body-s text-text-tertiary">
        To continue, please type “DELETE” in the box below.
      </p>
      <input
        id={inputId}
        aria-describedby={hintId}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder="Type DELETE"
        autoComplete="off"
        spellCheck={false}
        className={cn(fieldBox, 'mt-3 h-control-lg px-3 placeholder:text-text-tertiary')}
      />

      <div className="mt-6 flex justify-end gap-3 border-t border-border-subtle pt-5">
        <button
          type="button"
          onClick={() => {
            setTyped('');
            onCancel();
          }}
          className={cn(BUTTON_VARIANT.secondary, 'h-control-lg rounded-md px-6 text-body-m')}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!confirmed || remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              // Signed out straight after: the page used to say "deleted" and leave the user
              // signed in on Settings (audit ST-09).
              onSuccess: () => {
                setTyped('');
                showToast('Your account has been deleted.');
                void signOut(SIGN_IN, { afterDelete: true });
              },
              onError: () =>
                showToast("We couldn't delete your account. Try again.", { tone: 'error' }),
            })
          }
          className={cn(
            'inline-flex h-control-lg items-center justify-center rounded-md bg-danger-600 px-6 text-body-m font-semibold text-text-inverse not-disabled:hover:bg-danger-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-600 disabled:cursor-not-allowed disabled:opacity-50',
            pressable,
          )}
        >
          <StableLabel label="Delete my account" busyLabel="Deleting…" busy={remove.isPending} />
        </button>
      </div>
    </section>
  );
}
