'use client';

import type { AppSettings } from '@nextkin/shared/models';
import { useUpdateAppSettings } from '@nextkin/shared/queries';

import { AccountCard } from '@/features/account/components/AccountCard';
import { NavAiAssistantIllustration } from '@/ui/illustrations';
import { Switch } from '@/ui/Switch';

type Toggle = 'aiSuggestions' | 'experimentalFeatures' | 'personalizedRecommendations';

/** The board's three switches and the line beside each (356:162-182), verbatim. */
const TOGGLES: readonly { key: Toggle; label: string; description: string }[] = [
  {
    key: 'aiSuggestions',
    label: 'Show AI suggestions',
    description: 'Get personalized tips for your profile, jobs, and career growth.',
  },
  {
    key: 'experimentalFeatures',
    label: 'Include experimental features',
    description: "Try new features before they're widely released.",
  },
  {
    key: 'personalizedRecommendations',
    label: 'Personalize job recommendations',
    description: 'Use my activity and profile to improve job matches.',
  },
];

/**
 * "Content & AI preferences" (356:146): three switches on the one the Account page's
 * notifications use, each saved the moment it flips. They're stored; nothing reads them yet
 * (`toreview.md` §22). The line beside a switch drops under its name when the card is narrow.
 */
export function ContentAiCard({ settings }: { settings: AppSettings }) {
  const update = useUpdateAppSettings();

  const flip = (key: Toggle, on: boolean) => {
    const patch: Partial<AppSettings> = {};
    patch[key] = on;
    update.mutate(patch);
  };

  return (
    <AccountCard
      Art={NavAiAssistantIllustration}
      title="Content & AI preferences"
      description="Personalize the type of content and AI suggestions you receive."
    >
      <ul className="mt-2 flex flex-col">
        {TOGGLES.map(({ key, label, description }) => (
          <li key={key} className="flex min-h-11 items-center justify-between gap-4 py-1.5">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-body-m text-text-primary">{label}</span>
              <span className="text-body-s text-text-tertiary">{description}</span>
            </p>
            <Switch label={label} checked={settings[key]} onChange={(on) => flip(key, on)} />
          </li>
        ))}
      </ul>
    </AccountCard>
  );
}
