import type { ThemePreference } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { SoonTag } from '@/ui/Soon';
import {
  SettingsSessionsIllustration,
  SettingsThemeDarkIllustration,
  SettingsThemeLightIllustration,
} from '@/ui/illustrations';

const THEMES: readonly {
  id: ThemePreference;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  // Duotone since the redraw (356:103-124); System is the Active sessions monitor.
  { id: 'light', label: 'Light', Icon: SettingsThemeLightIllustration },
  { id: 'dark', label: 'Dark', Icon: SettingsThemeDarkIllustration },
  { id: 'system', label: 'System', Icon: SettingsSessionsIllustration },
];

/** Only light is drawn anywhere; dark, and following the device, wait for a dark palette. */
const AVAILABLE: ReadonlySet<ThemePreference> = new Set(['light']);

export type ThemePickerProps = {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
};

/**
 * "Light · Dark · System" (356:102), the chosen one on the brand outline. Every board is drawn
 * light and the app has no dark palette, so by your call Dark and System show but stay off until
 * one is designed (`toreview.md` §22). A radio group: one choice, saved the moment it's made.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid w-full grid-cols-3 gap-2.5">
      {THEMES.map(({ id, label, Icon }) => {
        const selected = id === value;
        const available = AVAILABLE.has(id);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!available}
            onClick={() => {
              if (!selected) onChange(id);
            }}
            className={cn(
              'flex h-control-lg min-w-0 items-center justify-center gap-2 rounded-md border bg-surface-card px-2 text-body-m transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-brand-600 bg-surface-brand text-brand-600'
                : 'border-border-default text-text-primary enabled:hover:bg-surface-muted',
            )}
          >
            <Icon aria-hidden className="h-auto max-h-6 w-7.5 shrink-0" />
            {label}
            {/* Said on the control, not in a tooltip a disabled button never opens (ST-10). */}
            {!available && <SoonTag />}
          </button>
        );
      })}
    </div>
  );
}
