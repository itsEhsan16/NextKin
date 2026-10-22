'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { CheckIcon } from '@/ui/icons';

import { menuSurfaceMotion, tickMotion } from './menuMotion';

export type FilterDropdownProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
};

/**
 * Wraps `@radix-ui/react-dropdown-menu` (already a dependency, unused anywhere in the app until
 * now) with token-styled surface/border/shadow and a focus ring — Radix supplies the actual
 * keyboard/ARIA behaviour (§8.7), this just makes it look like the rest of the app. The Jobs
 * board (304:2332) draws six chip triggers with no open state for any of them, so the *content*
 * of each dropdown is this component's caller's call, not something transcribed from Figma.
 *
 * It grows in from its trigger and leaves the same way, and its ticks fade (`menuMotion.ts`). A
 * trigger whose chevron should turn while it's open takes `menuTrigger`, its chevron
 * `chevronTurn`.
 */
export function FilterDropdown({ trigger, children, align = 'start' }: FilterDropdownProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={8}
          className={cn(
            'z-50 min-w-[220px] rounded-md border border-border-default bg-surface-card p-2 shadow-popover outline-none',
            menuSurfaceMotion,
          )}
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export type FilterCheckboxItemProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /**
   * Closes the menu once picked: a single choice (`SelectField`). A multi-select stays open, so
   * several rows can be ticked in one visit.
   */
  closeOnSelect?: boolean;
  children: ReactNode;
};

/** One row of a filter list (Location, Company, Job type, Experience), or of a select. */
export function FilterCheckboxItem({
  checked,
  onCheckedChange,
  closeOnSelect,
  children,
}: FilterCheckboxItemProps) {
  return (
    <Dropdown.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={closeOnSelect ? undefined : (event) => event.preventDefault()}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body-s text-text-primary outline-none',
        'data-[highlighted]:bg-surface-muted',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-default text-text-brand">
        <Dropdown.ItemIndicator className={tickMotion}>
          <CheckIcon className="size-3" />
        </Dropdown.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
    </Dropdown.CheckboxItem>
  );
}

export type MenuItemProps = {
  onSelect: () => void;
  /** `danger` for an action that undoes something: Connected accounts' "Disconnect". */
  tone?: 'default' | 'danger';
  /** Greyed out and skipped by the keyboard: an action already running (toreview §131). */
  disabled?: boolean;
  children: ReactNode;
};

/** One action in a menu, rather than a choice: it runs, and the menu closes. */
export function MenuItem({ onSelect, tone = 'default', disabled, children }: MenuItemProps) {
  return (
    <Dropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body-s outline-none data-[disabled]:cursor-default data-[disabled]:opacity-60',
        'data-[highlighted]:bg-surface-muted',
        // The danger red is under 4.5:1 on the highlight, so it darkens there.
        tone === 'danger'
          ? 'text-danger-600 data-[highlighted]:text-danger-text'
          : 'text-text-primary',
      )}
    >
      {children}
    </Dropdown.Item>
  );
}
