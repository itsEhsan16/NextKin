import type { ConnectedAccount, PrivacySettings } from '../../models';

/**
 * The web Settings → Privacy & data mockup's switches: visible to recruiters and found by them,
 * kept off search engines, sharing anonymized usage data. Shared, since mobile draws no screen
 * for them (as with `appSettings.ts`).
 */
export const privacySettingsFixture: PrivacySettings = {
  profileVisibility: 'recruiters',
  recruitersCanFind: true,
  searchEngines: false,
  shareAnonymizedData: true,
};

/** Google, not linked yet, as the Connected accounts mockup draws it. */
export const connectedAccountsFixture: ConnectedAccount[] = [
  { provider: 'google', connected: false },
];
