'use client';

import { useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

export type UnderlineTab<T extends string> = { id: T; label: string };

export type UnderlineTabsProps<T extends string> = {
  tabs: readonly UnderlineTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  /** The tab list's accessible name. */
  label: string;
  className?: string;
};

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
  className,
}: UnderlineTabsProps<T>) {
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
      className={cn('relative flex gap-6 border-b border-border-card max-xl:gap-4', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'whitespace-nowrap border-b-2 border-transparent pb-3 text-body-l font-semibold transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            active === tab.id ? 'text-brand-600' : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          {tab.label}
        </button>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-[3px] rounded-full w-(--tab-w,0px) translate-x-(--tab-x,0px) bg-brand-600 duration-base ease-standard in-data-placed:transition-[translate,width]"
      />
    </div>
  );
}
