import type { AccountSecurity } from '../../models';

import { daysAgo, minutesAgo } from './time';

/**
 * The web Settings board's security cards (Figma 254:522-590): a password last changed on
 * 14 January 2024, two-factor off, and three signed-in devices. Shared, since mobile draws no
 * screen for them (as with `documents.ts`); a phone that did would be its own current session.
 *
 * The date is the board's own "Jan 14, 2024", held at midday UTC so no time zone moves it to
 * another day. The devices' ages are relative, like every other fixture timestamp.
 */
export const securityFixture: AccountSecurity = {
  passwordChangedAt: '2024-01-14T12:00:00.000Z',
  twoFactorEnabled: false,
  sessions: [
    {
      id: 'ses_mac_chrome',
      device: 'desktop',
      platform: 'Mac',
      browser: 'Chrome',
      location: 'Bengaluru, India',
      lastActiveAt: minutesAgo(1),
      current: true,
    },
    {
      id: 'ses_iphone_safari',
      device: 'phone',
      platform: 'iPhone',
      browser: 'Safari',
      location: 'Bengaluru, India',
      lastActiveAt: daysAgo(3),
      current: false,
    },
    {
      // The board draws a tablet beside "Windows • Edge" (254:1122).
      id: 'ses_windows_edge',
      device: 'tablet',
      platform: 'Windows',
      browser: 'Edge',
      location: 'New Delhi, India',
      lastActiveAt: daysAgo(7),
      current: false,
    },
  ],
};
