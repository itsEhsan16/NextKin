import { createElement, type SVGProps } from 'react';

import { HUGE_GLYPHS } from './hugeGlyphs.generated';

export type HugeGlyph = keyof typeof HUGE_GLYPHS;

/**
 * Hugeicons on the web, the set mobile already draws everything with (owner, 2026-11-13: "all of
 * web, but only where we do not have any custom icons"). Every plain line icon — `lineIcons` and
 * `ui/icons` — is one of these; the coloured illustrations, company logos and the admin's animated
 * icons stay their own.
 *
 * Line icons in `currentColor`, sized by `className` (`size` sets the default box when none is
 * given); decorative unless given an `aria-label`.
 */
export function hugeIcon(glyph: HugeGlyph, size = 20) {
  function HugeIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden={props['aria-label'] ? undefined : true}
        className={className}
        {...props}
      >
        {HUGE_GLYPHS[glyph].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
      </svg>
    );
  }
  HugeIcon.displayName = `Huge(${glyph})`;
  return HugeIcon;
}

export const HugeLocation = hugeIcon('Location01');
export const HugeBriefcase = hugeIcon('Briefcase01');
export const HugeWorkHistory = hugeIcon('WorkHistory');
export const HugeCalendarCheck = hugeIcon('CalendarCheckIn01');
export const HugeCalendar = hugeIcon('Calendar03');
export const HugeIdCard = hugeIcon('IdCard');
export const HugeMoney = hugeIcon('Money03');
export const HugeFile = hugeIcon('File01');
export const HugeMoreVertical = hugeIcon('MoreVertical');
export const HugeArrowRight = hugeIcon('ArrowRight02');
export const HugeChevronDown = hugeIcon('ArrowDown01');
