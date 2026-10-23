import type { AccountSecurity } from '@nextkin/shared/models';

import { AccountCard } from '@/features/account/components/AccountCard';
import { formatShortDate } from '@/lib/format';
import { SettingsPasswordIllustration } from '@/ui/illustrations';

import { CardAction } from './CardAction';
import { InfoList, InfoRow } from './InfoList';

/**
 * "Password" (254:522): when it last changed, never the password itself, which only Cognito holds
 * (V2 §8.4). "Change password" waits for its form, as it does on the Account page.
 */
export function PasswordCard({ security }: { security: AccountSecurity }) {
  return (
    <AccountCard
      Art={SettingsPasswordIllustration}
      title="Password"
      description="Keep your password secure and change it regularly."
      action={<CardAction label="Change password" />}
    >
      <InfoList>
        <InfoRow label="Last changed">
          {security.passwordChangedAt ? formatShortDate(security.passwordChangedAt) : 'Not set'}
        </InfoRow>
      </InfoList>
    </AccountCard>
  );
}
