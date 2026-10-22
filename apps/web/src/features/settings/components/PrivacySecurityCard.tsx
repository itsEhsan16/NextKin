import type { AccountSecurity } from '@nextkin/shared/models';

import { AccountCard } from '@/features/account/components/AccountCard';
import {
  SettingsDevicePhoneIllustration,
  SettingsPrivacyIllustration,
  SettingsSessionsIllustration,
} from '@/ui/illustrations';

import { RowChevron, SETTING_LIST, SettingRow } from './SettingRow';
import { TwoFactorAction } from './TwoFactorCard';

export type PrivacySecurityCardProps = {
  security: AccountSecurity;
  /** "Active sessions" opens the Account section, where the devices are listed. */
  onOpenSessions: () => void;
};

/**
 * "Security" (Privacy & data mockup): two-factor and the signed-in devices, from the same account
 * security the Account section reads. "Enable" is that section's own action, and like it has
 * neither a flow nor a spec yet (`toreview.md` §21). "Active sessions" opens the Account section
 * and puts focus on its device list, rather than drawing a second one.
 */
export function PrivacySecurityCard({ security, onOpenSessions }: PrivacySecurityCardProps) {
  return (
    <AccountCard
      Art={SettingsPrivacyIllustration}
      title="Security"
      description="Keep your account secure."
    >
      <ul className={SETTING_LIST}>
        <SettingRow
          Icon={SettingsDevicePhoneIllustration}
          title="Two-factor authentication"
          line="Add an extra layer of security to your account."
          control={<TwoFactorAction on={security.twoFactorEnabled} />}
        />
        <SettingRow
          Icon={SettingsSessionsIllustration}
          title="Active sessions"
          line="Manage your logged-in devices."
          control={(lineId) => (
            <RowChevron label="Active sessions" describedBy={lineId} onClick={onOpenSessions} />
          )}
        />
      </ul>
    </AccountCard>
  );
}
