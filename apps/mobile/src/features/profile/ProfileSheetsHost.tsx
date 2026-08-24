import {
  AVAILABILITY_LABEL,
  LANGUAGE_LABEL,
  type Availability,
  type Language,
} from '@/data/models';
import { useProfile, useUpdatePreferences } from '@/data/queries';
import { formatLakh } from '@/lib';
import { useAppearanceStore, type AppearancePreference } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { useProfileStore } from './profileStore';

const APPEARANCE_OPTIONS: readonly SheetOption<AppearancePreference>[] = [
  { key: 'system', label: 'System', caption: 'Follows your device setting' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const LANGUAGE_OPTIONS: readonly SheetOption<Language>[] = (['en', 'de'] as const).map((key) => ({
  key,
  label: LANGUAGE_LABEL[key],
}));

const AVAILABILITY_OPTIONS: readonly SheetOption<Availability>[] = (
  ['immediately', '2_weeks', '1_month', 'open_to_offers', 'not_looking'] as const
).map((key) => ({ key, label: AVAILABILITY_LABEL[key] }));

/** Annual INR floors offered by the minimum-salary picker; 'none' clears the preference. */
const SALARY_STEPS = [
  1_000_000, 1_500_000, 2_000_000, 2_400_000, 3_000_000, 4_000_000, 5_000_000,
] as const;

const SALARY_OPTIONS: readonly SheetOption[] = [
  { key: 'none', label: 'No minimum' },
  ...SALARY_STEPS.map((amount) => ({ key: String(amount), label: formatLakh(amount) })),
];

/**
 * Mounts the Profile screen's sheets once, above the tab bar and the FAB, alongside the
 * filters and resume-menu hosts. Appearance writes the real theme store (persisted); the
 * preference pickers write through the profile repo; sign-out and delete-account stop at the
 * confirm — there is no session to end until auth lands (plan §Phase 8).
 */
export function ProfileSheetsHost() {
  const sheet = useProfileStore((state) => state.sheet);
  const open = useProfileStore((state) => state.sheetOpen);
  const closeSheet = useProfileStore((state) => state.closeSheet);

  const preference = useAppearanceStore((state) => state.preference);
  const setPreference = useAppearanceStore((state) => state.setPreference);

  const profile = useProfile();
  const updatePreferences = useUpdatePreferences();
  const prefs = profile.data?.preferences;

  if (!sheet) return null;

  switch (sheet) {
    case 'appearance':
      return (
        <OptionSheet
          open={open}
          title="Appearance"
          options={APPEARANCE_OPTIONS}
          selectedKey={preference}
          onSelect={(key) => {
            setPreference(key);
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'language':
      return (
        <OptionSheet
          open={open}
          title="Language"
          options={LANGUAGE_OPTIONS}
          selectedKey={prefs?.language}
          onSelect={(key) => {
            updatePreferences.mutate({ language: key });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'availability':
      return (
        <OptionSheet
          open={open}
          title="Availability"
          options={AVAILABILITY_OPTIONS}
          selectedKey={prefs?.availability}
          onSelect={(key) => {
            updatePreferences.mutate({ availability: key });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'min-salary':
      return (
        <OptionSheet
          open={open}
          title="Minimum salary"
          options={SALARY_OPTIONS}
          selectedKey={prefs?.minSalary?.min != null ? String(prefs.minSalary.min) : 'none'}
          onSelect={(key) => {
            updatePreferences.mutate({
              minSalary:
                key === 'none'
                  ? undefined
                  : { min: Number(key), currency: 'INR', period: 'year' },
            });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'sign-out':
      return (
        <ConfirmSheet
          open={open}
          title="Sign out?"
          message="You'll need to sign back in to keep tailoring resumes and tracking applications."
          confirmLabel="Sign out"
          onConfirm={closeSheet}
          onCancel={closeSheet}
        />
      );
    case 'delete-account':
      return (
        <ConfirmSheet
          open={open}
          title="Delete your account?"
          message="Your profile, resumes and application history will be permanently removed. This cannot be undone."
          confirmLabel="Delete account"
          onConfirm={closeSheet}
          onCancel={closeSheet}
        />
      );
  }
}
