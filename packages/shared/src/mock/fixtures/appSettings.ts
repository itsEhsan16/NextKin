import type { AppSettings } from '../../models';

/**
 * The web Settings → Preferences board's app settings (Figma 356:85-182): the light theme, dates
 * as "14 Jan 2024", India Standard Time, AI suggestions and personalised matches on, experiments
 * off. Shared, since mobile draws no screen for them (as with `security.ts`).
 */
export const appSettingsFixture: AppSettings = {
  theme: 'light',
  dateFormat: 'd_mmm_y',
  timeZone: 'Asia/Kolkata',
  aiSuggestions: true,
  experimentalFeatures: false,
  personalizedRecommendations: true,
};
