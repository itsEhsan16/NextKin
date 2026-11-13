'use client';

import { useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/cn';
import { SoonTag } from '@/ui/Soon';

export type UnderlineTab<T extends string> = {
  id: T;
  label: string;
  /** What it holds isn't built yet: the tab says "Soon" beside its name (redesign R6d). */
  soon?: boolean;
};

export type UnderlineTabsProps<T extends string> = {
  tabs: readonly UnderlineTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  /** The tab list's accessible name. */
  label: string;
  /**
   * The id of the panel the tabs control, so each tab names it (`aria-controls`) and the caller
   * can label the panel with the active tab: `aria-labelledby={tabId(idBase, active)}`.
   */
  idBase?: string;
  className?: string;
};

/** The id `UnderlineTabs` gives a tab, for a panel's `aria-labelledby`. */
export const tabId = (idBase: string, tab: string) => `${idBase}-tab-${tab}`;

/**
 * The underline tab bar a detail card switches its content with: Overview, About, Skills,
 * Benefits, Reviews on Jobs (304:2723); Overview, Application, Follow-ups, Notes on Applications
 * (286:1584).
 *
 * One underline slides to the picked tab and takes its width (`toreview.md` §84), rather than
 * each tab fading its own border in and out. Its place is measured after layout and written to
 * two custom properties on the list, not to React state, so a switch is one render; it follows
 * the tabs if they reflow. It only starts gliding once it has been placed, so it doesn't sweep in
 * from the left edge on arrival. Each tab keeps a transparent 2px border, so its text sits
 * exactly where it did.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  idBase,
  className,
}: UnderlineTabsProps<T>) {
  // Arrow keys move between tabs and select them, Home/End go to the ends, and only the selected
  // tab is in the Tab order (WAI-ARIA tabs, automatic activation; redesign R5a, audit JB-11).
  const move = (from: number, step: number | 'first' | 'last') => {
    const next =
      step === 'first'
        ? 0
        : step === 'last'
          ? tabs.length - 1
          : (from + step + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      list.style.setProperty('--tab-x', `${tab.offsetLeft}px`);
      list.style.setProperty('--tab-w', `${tab.offsetWidth}px`);
      list.setAttribute('data-placed', '');
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      // Labels never wrap; below 1280 (a narrower window, `toreview.md` §84) the tabs sit closer.
      className={cn('relative flex gap-6 border-b border-border-default max-xl:gap-4', className)}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={idBase ? tabId(idBase, tab.id) : undefined}
          aria-controls={idBase}
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const step =
              event.key === 'ArrowRight'
                ? 1
                : event.key === 'ArrowLeft'
                  ? -1
                  : event.key === 'Home'
                    ? 'first'
                    : event.key === 'End'
                      ? 'last'
                      : null;
            if (step === null) return;
            event.preventDefault();
            move(index, step);
          }}
          className={cn(
            'whitespace-nowrap border-b-2 border-transparent pb-3 text-body-l font-semibold transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            active === tab.id ? 'text-brand-600' : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          {tab.label}
          {tab.soon && <SoonTag className="ml-1.5 align-middle" />}
        </button>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-indicator rounded-full w-(--tab-w,0px) translate-x-(--tab-x,0px) bg-brand-600 duration-base ease-standard in-data-placed:transition-[translate,width]"
      />
    </div>
  );
}
