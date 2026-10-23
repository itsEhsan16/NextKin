'use client';

import type { AccountSecurity } from '@nextkin/shared/models';
import { usePrivacySettings } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { PrivacySecurityCard } from './PrivacySecurityCard';
import { PrivacySettingsCard } from './PrivacySettingsCard';
import { YourDataCard } from './YourDataCard';

export type PrivacySectionProps = {
  /** The account's security, which the page already loads for the Account section. */
  security: AccountSecurity | undefined;
  /** Where "Active sessions" goes: the Account section, which lists the devices. */
  onOpenAccount: () => void;
};

/**
 * "Settings → Privacy & data", built from your mockup rather than a Figma board: who sees the
 * profile, the account's data, and its security (`toreview.md` §30). The privacy settings load
 * here; the security comes from the page, which loads it for the Account section anyway.
 *
 * The cards arrive together, as the Account and Preferences sections' do, so none moves under the
 * pointer while the one above it loads. If the settings can't load, only their card says so: the
 * export and the security below come from elsewhere and still work. A failed refetch keeps the
 * settings it had, so it never takes the card away.
 */
export function PrivacySection({ security, onOpenAccount }: PrivacySectionProps) {
  const privacy = usePrivacySettings();

  if (privacy.isPending || !security) {
    return (
      <>
        <Skeleton className="h-84 rounded-lg" />
        <Skeleton className="h-68 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </>
    );
  }

  return (
    <>
      {privacy.data ? (
        <PrivacySettingsCard settings={privacy.data} />
      ) : (
        <StateView
          tone="danger"
          title="Couldn't load your privacy settings"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void privacy.refetch()}
        />
      )}
      <YourDataCard />
      <PrivacySecurityCard security={security} onOpenSessions={onOpenAccount} />
    </>
  );
}
