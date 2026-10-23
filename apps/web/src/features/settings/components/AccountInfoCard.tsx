import type { Profile, User } from '@nextkin/shared/models';

import { AccountCard } from '@/features/account/components/AccountCard';
import { ChevronRightIcon } from '@/ui/icons';
import { SettingsAccountIllustration } from '@/ui/illustrations';
import { Tag } from '@/ui/Tag';

import { CardAction } from './CardAction';
import { InfoList, InfoRow } from './InfoList';
import { Soon, soonControl } from '@/ui/Soon';
import { cn } from '@/lib/cn';

/** The chevron ending Phone number and Location (254:514, 254:521). Inert, like Edit. */
function RowChevron({ label }: { label: string }) {
  return (
    <Soon>
      <button
        aria-disabled="true"
        type="button"
        aria-label={label}
        className={cn(
          '-mr-1.5 flex size-control-sm shrink-0 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          soonControl,
        )}
      >
        <ChevronRightIcon aria-hidden className="size-4" />
      </button>
    </Soon>
  );
}

/**
 * "Account information" (254:483): the name, the address and whether it is verified, the phone
 * and the place, read off the account every page shows. The board draws a Priya Sharma; this is
 * George, by your call (`toreview.md` §21). Edit and the chevrons have no form behind them yet,
 * so they are inert, as the Account page's Edit is.
 */
export function AccountInfoCard({ user, profile }: { user: User; profile: Profile }) {
  return (
    <AccountCard
      Art={SettingsAccountIllustration}
      title="Account information"
      description="Keep your account details up to date."
      action={<CardAction label="Edit" accessibleName="Edit account information" />}
    >
      <InfoList>
        <InfoRow label="Full name">{`${user.firstName} ${user.lastName}`}</InfoRow>
        <InfoRow label="Email address">
          <span className="flex min-w-0 items-center gap-4">
            <span className="truncate">{user.email}</span>
            {user.emailVerified && (
              <Tag tone="success" className="gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-success-600" />
                Verified
              </Tag>
            )}
          </span>
        </InfoRow>
        <InfoRow label="Phone number" trailing={<RowChevron label="Change phone number" />}>
          {profile.phone ?? 'Not added'}
        </InfoRow>
        <InfoRow label="Location" trailing={<RowChevron label="Change location" />}>
          {profile.location ?? 'Not added'}
        </InfoRow>
      </InfoList>
    </AccountCard>
  );
}
