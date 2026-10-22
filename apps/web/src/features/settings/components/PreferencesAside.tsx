import Link from 'next/link';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { LaunchIcon, TickIcon } from '@/ui/icons';
import { SettingsLightbulbIllustration, SettingsPreferencesIllustration } from '@/ui/illustrations';

/** "Why set preferences?" (356:185), the board's four reasons verbatim. */
const REASONS = [
  'Get more relevant job recommendations',
  'Save time with a personalized experience',
  'Receive content that matches your goals',
  'Make NextKin work your way',
];

/**
 * The column beside the Preferences cards (356:183): why the settings matter, a line from the
 * team, and the way to help. The board's two lavender gradients are the flat brand washes, and
 * its italic quote is set upright like the Account page's motto (`toreview.md` §22). "Visit Help
 * Center" opens the app's Help page, which is still a placeholder.
 */
export function PreferencesAside() {
  const reasonsId = useId();
  const helpId = useId();

  return (
    <aside aria-label="About preferences" className="flex min-w-0 flex-col gap-3">
      <section
        aria-labelledby={reasonsId}
        className="rounded-lg border border-border-card bg-surface-card p-3"
      >
        <div className="rounded-md bg-surface-brand px-3.5 py-3">
          <h2
            id={reasonsId}
            className="flex items-center gap-2 text-body-l font-bold text-text-primary"
          >
            <SettingsLightbulbIllustration aria-hidden className="-my-1 h-auto w-8 shrink-0" />
            Why set preferences?
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {REASONS.map((reason) => (
              <li key={reason} className="flex items-start gap-3 text-body-m text-text-secondary">
                <TickIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <figure className="rounded-lg border border-border-card bg-surface-card px-5 pb-4 pt-3">
        <span aria-hidden className="block text-display-l text-brand-600">
          “
        </span>
        <blockquote className="text-body-m text-text-secondary">
          “A more personalized experience helps you discover the right opportunities, faster.”
        </blockquote>
        <figcaption className="mt-2 text-body-s text-text-tertiary">– The NextKin Team</figcaption>
      </figure>

      <section aria-labelledby={helpId} className="rounded-lg bg-surface-brand-strong p-5">
        <SettingsPreferencesIllustration aria-hidden className="h-auto w-9" />
        <h2 id={helpId} className="mt-3 text-title-l text-text-primary">
          Need help?
        </h2>
        <p className="mt-1 text-body-m text-text-secondary">
          Check our help center for more information about settings and preferences.
        </p>
        <Link
          href="/help"
          className={cn(
            brandOutlineButton,
            'mt-4 h-control-lg w-full gap-2 rounded-md text-body-m font-semibold',
          )}
        >
          Visit Help Center
          <LaunchIcon aria-hidden className="size-4" />
        </Link>
      </section>
    </aside>
  );
}
