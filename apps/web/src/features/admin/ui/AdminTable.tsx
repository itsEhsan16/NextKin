'use client';

import type { ChangeEvent, ReactNode } from 'react';

import { AdminIcon } from '@/ui/animated/AdminIcon';

import { adminButton } from './adminButton';

/**
 * The admin boards' table (Users, Figma 404:862; Recent admin activity 396:750): a slate header
 * row of 12px medium labels, white rows on a 1px slate rule, 24px in from the left. Plain semantic
 * `<table>` markup with these classes; columns set their own widths.
 */
export const adminTable = {
  /** The `<table>`: fixed layout so columns hold their widths, and a floor before it scrolls. */
  table: 'w-full table-fixed border-collapse',
  head: 'border-b border-neutral-200 bg-neutral-50',
  th: 'px-4 py-3 text-left text-caption-m font-medium text-text-secondary first:pl-6 last:pr-4',
  row: 'animate-rise border-b border-neutral-100 transition-colors duration-press ease-standard last:border-b-0 hover:bg-neutral-50',
  /** A selected row, as the Users board draws Sofia Rossi's (404:614). */
  rowSelected: 'bg-brand-50 hover:bg-brand-50',
  td: 'px-4 py-4 align-middle text-body-s text-text-secondary first:pl-6 last:pr-4',
  /** The two-line cell: a name over an email or role. */
  primary: 'truncate text-body-s font-semibold text-text-primary',
  secondary: 'truncate text-body-s text-text-secondary',
};

/** The header's sort control: the label and an arrow that turns with the direction (404:614). */
export function SortHeader({
  label,
  direction,
  onToggle,
}: {
  label: string;
  /** `null` when the table isn't sorted by this column. */
  direction: 'asc' | 'desc' | null;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sort by ${label}${direction ? `, ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      className="-mx-1 inline-flex items-center gap-3 rounded-[4px] px-1 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      {label}
      <AdminIcon
        name={direction === 'asc' ? 'ArrowUp' : 'ArrowDown'}
        size="xs"
        className="transition-[rotate] duration-fast"
      />
    </button>
  );
}

/** The boards' 16px checkbox (Figma 404:864): slate outline, a filled indigo tick when on. */
export function AdminCheckbox({
  checked,
  onChange,
  label,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Always named, since a table's checkbox has no visible label of its own. */
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <label className="relative inline-flex size-4 shrink-0 cursor-pointer after:absolute after:-inset-3.5">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        ref={(element) => {
          if (element) element.indeterminate = indeterminate;
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
        className="peer absolute inset-0 cursor-pointer appearance-none rounded-[4px] border border-neutral-300 bg-surface-card transition-colors duration-press ease-standard checked:border-brand-600 checked:bg-brand-600 indeterminate:border-brand-600 indeterminate:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      {indeterminate ? (
        <span className="pointer-events-none relative m-auto h-0.5 w-2 rounded-full bg-text-inverse" />
      ) : (
        <AdminIcon
          name="Check"
          size="xs"
          className="pointer-events-none relative m-auto text-text-inverse opacity-0 transition-opacity duration-press peer-checked:opacity-100"
        />
      )}
    </label>
  );
}

/** "Previous · Page 1 of 2,411 · Next" under a table (Figma 404:1130). */
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Pages"
      className="flex items-center gap-3 border-t border-neutral-200 px-6 pb-4 pt-3"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={adminButton.small}
      >
        Previous
      </button>
      <p className="flex-1 text-center text-body-s font-medium text-neutral-700" aria-live="polite">
        Page {page.toLocaleString('en-US')} of {Math.max(1, pages).toLocaleString('en-US')}
      </p>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className={adminButton.small}
      >
        Next
      </button>
    </nav>
  );
}

/** A table's toolbar row: tabs on the left, search and filters on the right (Figma 404:837). */
export function TableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 py-3.5 pl-5 pr-4">
      {children}
    </div>
  );
}
