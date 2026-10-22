'use client';

import type { AppSettings, Language } from '@nextkin/shared/models';
import { useUpdateAppSettings, useUpdatePreferences } from '@nextkin/shared/queries';

import { AccountCard } from '@/features/account/components/AccountCard';
import { NavSettingsIllustration } from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';

import {
  DATE_FORMAT_LABEL,
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTION_LABEL,
  LANGUAGE_OPTIONS,
  TIME_ZONE_OPTIONS,
  timeZoneLabel,
  withChosen,
} from '../preferencesLibrary';
import { FieldRow } from './FieldRow';
import { ThemePicker } from './ThemePicker';

export type AppSettingsCardProps = { settings: AppSettings; language: Language };

/**
 * "App settings" (356:85): the theme, the language, how dates read and the time zone, each saved
 * the moment it changes. The language is the profile's own preference, which the Account page
 * reads too; the rest are the account's app settings. None of them restyles or reformats the app
 * yet: there is no dark palette, the UI ships in English (V2 §8.8), and every board prints its own
 * dates (`toreview.md` §22).
 */
export function AppSettingsCard({ settings, language }: AppSettingsCardProps) {
  const updateSettings = useUpdateAppSettings();
  const updatePreferences = useUpdatePreferences();
  const save = (patch: Partial<AppSettings>) => updateSettings.mutate(patch);

  return (
    <AccountCard
      Art={NavSettingsIllustration}
      title="App settings"
      description="Customize how NextKin looks and feels for you."
    >
      <div className="mt-3">
        <FieldRow label="Theme">
          <ThemePicker value={settings.theme} onChange={(theme) => save({ theme })} />
        </FieldRow>
        <FieldRow label="Language">
          <SelectField
            label="Language"
            value={language}
            options={LANGUAGE_OPTIONS}
            labelOf={(option) => LANGUAGE_OPTION_LABEL[option]}
            onChange={(next) => updatePreferences.mutate({ language: next })}
          />
        </FieldRow>
        <FieldRow label="Date format">
          <SelectField
            label="Date format"
            value={settings.dateFormat}
            options={DATE_FORMAT_OPTIONS}
            labelOf={(option) => DATE_FORMAT_LABEL[option]}
            onChange={(dateFormat) => save({ dateFormat })}
          />
        </FieldRow>
        <FieldRow label="Time zone">
          <SelectField
            label="Time zone"
            value={settings.timeZone}
            options={withChosen(TIME_ZONE_OPTIONS, [settings.timeZone])}
            labelOf={timeZoneLabel}
            onChange={(timeZone) => save({ timeZone })}
          />
        </FieldRow>
      </div>
    </AccountCard>
  );
}
