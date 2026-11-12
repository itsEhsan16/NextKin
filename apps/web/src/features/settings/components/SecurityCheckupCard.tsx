import type { AccountSecurity } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import {
  SettingsDevicePhoneIllustration,
  SettingsPasswordIllustration,
  SettingsPrivacyIllustration,
  SettingsSessionsIllustration,
} from '@/ui/illustrations';
import { Tag } from '@/ui/Tag';

const DAY_MS = 86_400_000;

/**
 * How old a password is before the checkup asks for a look: a year. Neither the board nor V2 sets
 * a number; the card's own line says to change it "regularly" (`toreview.md` §92).
 */
const PASSWORD_REVIEW_DAYS = 365;

/** "Over 2 years old", "Under a year old" (577:4177). */
export function passwordAge(changedAt: string, now: Date = new Date()): string {
  const years = Math.floor((now.getTime() - new Date(changedAt).getTime()) / (365.25 * DAY_MS));
  if (years < 1) return 'Under a year old';
  return `Over ${years} year${years === 1 ? '' : 's'} old`;
}

type Check = {
  key: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  line: string;
  /** Drawn in the warning ink, and counted in "2 to review". */
  review: boolean;
};

function checks(security: AccountSecurity, now: Date): Check[] {
  const changed = security.passwordChangedAt;
  const stale =
    changed != null && now.getTime() - new Date(changed).getTime() > PASSWORD_REVIEW_DAYS * DAY_MS;
  const others = security.sessions.filter((session) => !session.current).length;
  const devices = security.sessions.length;

  return [
    {
      key: 'password',
      Art: SettingsPasswordIllustration,
      label: 'Password age',
      value: changed ? passwordAge(changed, now) : 'No password',
      line: changed ? `Last changed ${formatShortDate(changed)}` : 'You sign in with Google',
      review: stale,
    },
    {
      key: 'two-factor',
      Art: SettingsDevicePhoneIllustration,
      label: 'Two-factor',
      value: security.twoFactorEnabled ? 'On' : 'Off',
      // Two-factor can't be turned on yet, so it isn't counted as something to review (ST-18).
      line: security.twoFactorEnabled ? 'Your account asks for a code' : 'Not available yet',
      review: false,
    },
    {
      key: 'sessions',
      Art: SettingsSessionsIllustration,
      label: 'Active sessions',
      value: `${devices} device${devices === 1 ? '' : 's'}`,
      line:
        others === 0
          ? 'Only this device'
          : `This device and ${others} other${others === 1 ? '' : 's'}`,
      review: false,
    },
  ];
}

/**
 * "Security checkup" (577:4142): the password's age, two-factor and the signed-in devices at a
 * glance, read off the same account security the cards under it show. What needs a look is drawn
 * in the warning ink and counted in the pill.
 */
export function SecurityCheckupCard({
  security,
  now = new Date(),
}: {
  security: AccountSecurity;
  now?: Date;
}) {
  const items = checks(security, now);
  const toReview = items.filter((item) => item.review).length;

  return (
    <AccountCard
      Art={SettingsPrivacyIllustration}
      title="Security checkup"
      description="A quick look at how your account is protected."
      action={
        <Tag
          tone={toReview > 0 ? 'warning' : 'success'}
          shape="pill"
          className="shrink-0 gap-1.5 self-center"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {toReview > 0 ? `${toReview} to review` : 'All good'}
        </Tag>
      }
    >
      <ul className="mt-5 grid grid-cols-3 gap-4">
        {items.map(({ key, Art, label, value, line, review }) => (
          <li
            key={key}
            className="flex min-w-0 items-center gap-3 rounded-md bg-neutral-50 px-4 py-3.5"
          >
            <span aria-hidden className="flex w-9 shrink-0 justify-center">
              <Art className="h-auto max-h-8 w-9" />
            </span>
            <span className="min-w-0">
              <span className="block text-body-s text-text-tertiary">{label}</span>
              <span
                className={cn(
                  'block truncate text-body-l',
                  review ? 'text-warning-text' : 'text-text-primary',
                )}
              >
                {value}
                {review && <span className="sr-only">, needs a look</span>}
              </span>
              <span className="block truncate text-body-s text-text-tertiary">{line}</span>
            </span>
          </li>
        ))}
      </ul>
    </AccountCard>
  );
}
