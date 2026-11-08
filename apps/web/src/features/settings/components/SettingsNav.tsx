import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import {
  SettingsAccountIllustration,
  SettingsBillingIllustration,
  SettingsConnectedIllustration,
  SettingsDeleteIllustration,
  SettingsNotificationsIllustration,
  SettingsPreferencesIllustration,
  SettingsPrivacyIllustration,
  SettingsSecurityIllustration,
} from '@/ui/illustrations';
import { SlidingHighlight } from '@/ui/SlidingHighlight';

import {
  SETTINGS_SECTION_ORDER,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '../settingsLibrary';

/**
 * Each row's duotone glyph (356:497-565, redrawn from 254:1015-1081). The board draws the same
 * person and shield again on the Account section's cards, so those are one export each.
 */
export const SECTION_ICON: Record<SettingsSection, ComponentType<SVGProps<SVGSVGElement>>> = {
  account: SettingsAccountIllustration,
  preferences: SettingsPreferencesIllustration,
  notifications: SettingsNotificationsIllustration,
  privacy: SettingsPrivacyIllustration,
  connected: SettingsConnectedIllustration,
  billing: SettingsBillingIllustration,
  security: SettingsSecurityIllustration,
  delete: SettingsDeleteIllustration,
};

/** The panel the selected row shows; `SettingsScreen` renders it with this id. */
export const SETTINGS_PANEL_ID = 'settings-panel';
export const settingsTabId = (section: SettingsSection): string => `settings-tab-${section}`;

export type SettingsNavProps = {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
  className?: string;
};

/**
 * The sections down the left (254:1009): a glyph, a name and the line under it, the selected one
 * on the board's lavender wash. Tabs, as on the Account page, since each swaps the panel beside
 * it rather than going anywhere; like every tab row in the app they answer Tab and Enter, not the
 * arrow keys (`toreview.md` §20.2). The name is the tab's label and the line its description.
 *
 * The wash glides to the row you pick, as the sidebar's highlight does (`SlidingHighlight`,
 * `toreview.md` §31), rather than fading out of one row and into the next. That needs every row
 * to be one height, its two lines plus 10px above and below, so neither line may wrap: a line too
 * long for the column ends in an ellipsis instead, and stays whole as the tab's description.
 */
export function SettingsNav({ active, onChange, className }: SettingsNavProps) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Settings sections"
      className={cn(cardSurface, 'p-2', className)}
    >
      {/* Only the rows in here, so the wash's arithmetic starts at this box's top. A row is Body/L's
          line (20), Body/S's (18) and 10px above and below: 58, as the rows measured before. */}
      <div className="relative flex flex-col gap-token-2 [--settings-row:calc(var(--text-body-l--line-height)+var(--text-body-s--line-height)+var(--spacing-token-20))]">
        <SlidingHighlight
          index={SETTINGS_SECTION_ORDER.indexOf(active)}
          row="var(--settings-row)"
          gap="var(--spacing-token-2)"
          className="rounded-md bg-surface-brand-strong shadow-button"
        />

        {SETTINGS_SECTION_ORDER.map((id) => {
          const { label, description } = SETTINGS_SECTIONS[id];
          const Icon = SECTION_ICON[id];
          const selected = id === active;
          const tabId = settingsTabId(id);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={tabId}
              aria-label={label}
              aria-describedby={`${tabId}-line`}
              aria-selected={selected}
              aria-controls={SETTINGS_PANEL_ID}
              onClick={() => onChange(id)}
              className={cn(
                'relative flex h-(--settings-row) w-full items-center gap-3 rounded-md px-3 text-left transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                // Hover stays a shade lighter than the selected wash, so pointing isn't selecting.
                // The selected row takes no fill of its own: the wash behind it is the fill.
                !selected && 'hover:bg-neutral-50',
              )}
            >
              <span aria-hidden className="flex w-9 shrink-0 justify-center">
                <Icon className="h-auto max-h-8 w-9" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body-l font-semibold text-text-primary">
                  {label}
                </span>
                <span
                  id={`${tabId}-line`}
                  className="block truncate text-body-s text-text-tertiary"
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
