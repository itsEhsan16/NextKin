import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import {
  ProfileAccountIllustration,
  ProfileEducationIllustration,
  ProfileExperienceIllustration,
  ProfileGoalsIllustration,
  ProfileLinksIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';

import { PROFILE_TABS, type ProfileTab } from '../profileLibrary';
import { pressable } from '@/ui/pressable';

const TAB_ART: Record<ProfileTab, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: ProfileAccountIllustration,
  experience: ProfileExperienceIllustration,
  education: ProfileEducationIllustration,
  skills: ProfileSkillsIllustration,
  preferences: ProfileGoalsIllustration,
  links: ProfileLinksIllustration,
};

/** The panel the selected tab shows; `ProfileScreen` renders it with this id. */
export const PROFILE_PANEL_ID = 'profile-panel';
export const profileTabId = (tab: ProfileTab): string => `profile-tab-${tab}`;

/**
 * "Overview", "Experience", "Education"… (476:31): each section a duotone glyph and a word. The
 * selected one takes the board's lavender wash and edge.
 */
export function ProfileTabs({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Profile sections" className="flex flex-wrap gap-2.5">
      {PROFILE_TABS.map(({ id, label }) => {
        const Art = TAB_ART[id];
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={profileTabId(id)}
            aria-selected={selected}
            aria-controls={PROFILE_PANEL_ID}
            onClick={() => onChange(id)}
            className={cn(
              pressable,
              'flex h-control-md items-center gap-2 rounded-lg border pl-3 pr-3.5 text-body-l font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              selected
                ? 'border-border-brand-strong bg-surface-brand text-brand-700'
                : 'border-border-faint bg-surface-card text-text-secondary hover:bg-surface-muted',
            )}
          >
            <Art aria-hidden className="h-auto max-h-5.5 w-7 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
