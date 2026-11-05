'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

export type SettingsTab = 'security' | 'sessions' | 'notifications' | 'retention';

export const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'security', label: 'Security' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'retention', label: 'Data retention' },
];

const STEP: Record<string, (at: number, last: number) => number> = {
  ArrowRight: (at, last) => (at >= last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at <= 0 ? last : at - 1),
  Home: () => 0,
  End: (_at, last) => last,
};

/**
 * Settings' tabs (Figma 409:1661): 13px SemiBold labels 20px apart over a slate rule, the chosen
 * one in indigo with a 2px indigo underline. A tablist: arrows move and choose.
 */
export function SettingsTabs({
  value,
  onChange,
}: {
  value: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = SETTINGS_TABS.findIndex((tab) => tab.id === value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    const next = step(at, SETTINGS_TABS.length - 1);
    const tab = SETTINGS_TABS[next];
    if (!tab) return;
    event.preventDefault();
    onChange(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      onKeyDown={onKeyDown}
      className="flex gap-5 border-b border-neutral-200"
    >
      {SETTINGS_TABS.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`settings-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`settings-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-1 pb-3 pt-0.5 text-body-s font-semibold transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              selected
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-text-tertiary hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
