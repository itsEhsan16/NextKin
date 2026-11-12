'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';

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
            'z-dropdown min-w-[220px] rounded-lg border border-border-subtle bg-surface-card p-1.5 shadow-popover outline-none',
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
        'group/item flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body-m text-text-primary outline-none transition-colors duration-press ease-standard',
        'data-[highlighted]:bg-surface-muted',
      )}
    >
      {/* A checkbox, square and filled when ticked (owner, 2026-11-04): the filled check-circle
          inside a round box read as a broken radio. */}
      <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-default bg-surface-card text-white transition-colors duration-press ease-standard group-data-[state=checked]/item:border-brand-600 group-data-[state=checked]/item:bg-brand-600">
        <Dropdown.ItemIndicator className={tickMotion}>
          <Check aria-hidden className="size-3" />
        </Dropdown.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
    </Dropdown.CheckboxItem>
  );
}

export type FilterRadioGroupProps<V extends string> = {
  value: V | undefined;
  onValueChange: (value: V) => void;
  options: readonly (readonly [V, string])[];
};

/**
 * A single choice in a menu (redesign R6a, audit RS-08): sort orders, "Last updated". Radio rows
 * with a round mark, so a one-of-many list never looks like a multi-select. Picking closes the
 * menu.
 */
export function FilterRadioGroup<V extends string>({
  value,
  onValueChange,
  options,
}: FilterRadioGroupProps<V>) {
  return (
    <Dropdown.RadioGroup value={value ?? ''} onValueChange={(next) => onValueChange(next as V)}>
      {options.map(([option, label]) => (
        <Dropdown.RadioItem
          key={option}
          value={option}
          className={cn(
            'group/item flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body-m text-text-primary outline-none transition-colors duration-press ease-standard',
            'data-[highlighted]:bg-surface-muted',
          )}
        >
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-card transition-colors duration-press ease-standard group-data-[state=checked]/item:border-brand-600">
            <Dropdown.ItemIndicator className={tickMotion}>
              <span className="block size-2 rounded-full bg-brand-600" />
            </Dropdown.ItemIndicator>
          </span>
          <span className="truncate">{label}</span>
        </Dropdown.RadioItem>
      ))}
    </Dropdown.RadioGroup>
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
        'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body-m outline-none transition-colors duration-press ease-standard data-[disabled]:cursor-default data-[disabled]:opacity-60',
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
