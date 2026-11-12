'use client';

import type { PrivacySettings } from '@nextkin/shared/models';
import { useUpdatePrivacySettings } from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import {
  NavInterviewPrepIllustration,
  ProfileLanguageIllustration,
  SettingsAccountIllustration,
  SettingsMatchScoreIllustration,
  SettingsSecurityIllustration,
} from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';
import { SoonTag } from '@/ui/Soon';
import { Switch } from '@/ui/Switch';

import { SaveStatus, useSaveStatus } from '../useSaveStatus';

import { PROFILE_VISIBILITY_LABEL, PROFILE_VISIBILITY_OPTIONS } from '../settingsLibrary';
import { SETTING_LIST, SettingRow } from './SettingRow';

type Toggle = 'recruitersCanFind' | 'searchEngines' | 'shareAnonymizedData';

/** The mockup's three switches, each with its glyph and the line under it, verbatim. */
const TOGGLES: readonly {
  key: Toggle;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  line: string;
}[] = [
  {
    key: 'recruitersCanFind',
    Icon: NavInterviewPrepIllustration,
    title: 'Let recruiters find you',
    line: 'Allow verified recruiters to discover and contact you.',
  },
  {
    key: 'searchEngines',
    Icon: ProfileLanguageIllustration,
    title: 'Show on search engines',
    line: 'Allow your profile to appear in Google and other search engines.',
  },
  {
    key: 'shareAnonymizedData',
    Icon: SettingsMatchScoreIllustration,
    title: 'Share anonymized data',
    line: 'Help us improve NextKin by sharing anonymized usage data.',
  },
];

/** The one switch something reads today: V2 §8.5's analytics opt-out. */
const LIVE = new Set<Toggle>(['shareAnonymizedData']);

/**
 * "Privacy settings" (Privacy & data mockup): who can see the profile, and three switches, each
 * saved the moment it changes and described by its row's line. By your call the recruiter and
 * search-engine settings are built as drawn, though V2's Release 1 has neither a recruiter portal
 * nor a public profile, so nothing reads them yet. "Share anonymized data" is V2 §8.5's analytics
 * opt-out (`toreview.md` §30).
 */
export function PrivacySettingsCard({ settings }: { settings: PrivacySettings }) {
  const update = useUpdatePrivacySettings();
  const saved = useSaveStatus();
  const save = (patch: Partial<PrivacySettings>) =>
    saved.run((options) => update.mutate(patch, options));

  const flip = (key: Toggle, on: boolean) => {
    const patch: Partial<PrivacySettings> = {};
    patch[key] = on;
    save(patch);
  };

  return (
    <AccountCard
      Art={SettingsSecurityIllustration}
      title="Privacy settings"
      description="Manage how your information is used and who can see it."
      action={<SaveStatus state={saved.state} />}
    >
      <ul className={SETTING_LIST}>
        <SettingRow
          Icon={SettingsAccountIllustration}
          title="Profile visibility"
          line="Choose who can view your profile (recruiters, public, or private)."
          control={(lineId) => (
            // No public profile or recruiter portal in Release 1 (V2 §6.2): shown, off, "Soon".
            <span className="flex items-center gap-2">
              <SoonTag />
              <SelectField
                label="Profile visibility"
                describedBy={lineId}
                value={settings.profileVisibility}
                options={PROFILE_VISIBILITY_OPTIONS}
                labelOf={(option) => PROFILE_VISIBILITY_LABEL[option]}
                onChange={() => undefined}
                disabled
                className="w-48"
              />
            </span>
          )}
        />
        {TOGGLES.map(({ key, Icon, title, line }) => (
          <SettingRow
            key={key}
            Icon={Icon}
            title={title}
            line={line}
            control={(lineId) => (
              <span className="flex items-center gap-2">
                {!LIVE.has(key) && <SoonTag />}
                <Switch
                  label={title}
                  describedBy={lineId}
                  checked={settings[key]}
                  disabled={!LIVE.has(key)}
                  onChange={(on) => flip(key, on)}
                />
              </span>
            )}
          />
        ))}
      </ul>
    </AccountCard>
  );
}
