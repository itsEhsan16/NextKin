import type { AppSettings, ProfilePreferences } from '@nextkin/shared/models';

import { AppSettingsCard } from './AppSettingsCard';
import { ContentAiCard } from './ContentAiCard';
import { JobPreferencesCard } from './JobPreferencesCard';
import { PreferencesAside } from './PreferencesAside';

export type PreferencesSectionProps = {
  preferences: ProfilePreferences;
  settings: AppSettings;
};

/**
 * "Settings → Preferences" (356:2): three cards of settings beside a column about them (356:183).
 * The column is 256px, the board's 280 less enough that the time zone fits beside it at 1396 with
 * the sidebar open. It stays beside the cards while the section is at least 800px wide and drops
 * under them when it isn't (1280 with the sidebar open), so no card gets narrower than its fields.
 * The panel it sits in is the container that width is measured on.
 */
export function PreferencesSection({ preferences, settings }: PreferencesSectionProps) {
  return (
    <div className="grid items-start gap-3 @min-[50rem]:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <JobPreferencesCard preferences={preferences} />
        <AppSettingsCard settings={settings} language={preferences.language} />
        <ContentAiCard settings={settings} />
      </div>
      <PreferencesAside />
    </div>
  );
}
