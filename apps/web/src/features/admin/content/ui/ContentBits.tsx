'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Spinner } from '@/ui/Spinner';

import { AdminBadge } from '../../ui/AdminBadge';
import { adminButton } from '../../ui/adminButton';
import { formatScore } from '../format';

/**
 * The small pieces the Content boards share: a button with a glyph that plays on hover, the
 * underline tabs (Technology KB 409:2082, the prompt editor), alias chips, the blue info callout,
 * an eval-score badge and a version chip.
 */

export type ActionButtonProps = {
  variant?: keyof typeof adminButton;
  icon?: AdminIconName;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  label?: string;
};

export function ActionButton({
  variant = 'secondary',
  icon,
  children,
  onClick,
  href,
  disabled,
  busy,
  className,
  label,
}: ActionButtonProps) {
  const { iconRef, hoverProps } = useIconHover();
  const glyph = busy ? (
    <Spinner className="size-4" />
  ) : (
    icon && <AdminIcon ref={iconRef} name={icon} />
  );
  const classes = cn(adminButton[variant], className);
  if (href) {
    return (
      <Link href={href as Route} aria-label={label} {...hoverProps} className={classes}>
        {glyph}
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...hoverProps}
      className={classes}
    >
      {glyph}
      {children}
    </button>
  );
}

/**
 * A text link with a trailing glyph ("Show all 15 versions", "View all 41 →"). `size="md"` is the
 * boards' 36px link button with a 20px glyph (Skills 406:2073, 410:1763); `sm` is the bare 20px
 * line. `label` names it for assistive tech where the visible text repeats ("Dismiss").
 */
export function TextAction({
  children,
  icon,
  onClick,
  href,
  className,
  size = 'sm',
  label,
}: {
  children: ReactNode;
  icon?: AdminIconName;
  onClick?: () => void;
  href?: string;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const { iconRef, hoverProps } = useIconHover();
  const classes = cn(
    'relative inline-flex items-center gap-1.5 self-start rounded-sm text-body-s font-semibold text-brand-700 transition-colors duration-press hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 after:absolute after:-inset-x-1',
    size === 'md' ? 'py-2 after:-inset-y-1' : 'after:-inset-y-3',
    className,
  );
  const inner = (
    <>
      {children}
      {icon && <AdminIcon ref={iconRef} name={icon} size={size === 'md' ? 'lg' : 'sm'} />}
    </>
  );
  if (href) {
    const external = href.startsWith('http');
    return external ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        {...hoverProps}
        className={classes}
      >
        {inner}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    ) : (
      <Link href={href as Route} aria-label={label} {...hoverProps} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} {...hoverProps} className={classes}>
      {inner}
    </button>
  );
}

export type TabOption<T extends string> = { id: T; label: string; count?: number | null };

/** Tabs with a brand underline under the chosen one (Figma 409:2082); arrow keys move. */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = options.findIndex((o) => o.id === value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (at + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex items-end gap-5 border-b border-neutral-200', className)}
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(
              '-mb-px flex items-start gap-2 whitespace-nowrap border-b-2 px-1 pb-3 pt-0.5 text-body-s font-semibold transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
              selected
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            )}
          >
            {option.label}
            {option.count != null && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-caption-m',
                  selected
                    ? 'border-brand-100 bg-brand-50 text-brand-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700',
                )}
              >
                {option.count.toLocaleString('en-US')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A technology's or skill's aliases as small chips; "—" or a muted note when none. `pill` is the
 * Skills and Technology KB boards' slate pill (406:1829, 409:1872); `pill={false}` gives an outlined chip.
 */
export function AliasChips({
  aliases,
  empty = '—',
  pill = true,
}: {
  aliases: string[];
  empty?: string;
  pill?: boolean;
}) {
  if (aliases.length === 0) {
    return (
      <span className={cn('text-body-s', pill ? 'text-neutral-400' : 'text-text-tertiary')}>
        {empty}
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Aliases">
      {aliases.map((alias) => (
        <li
          key={alias}
          className={cn(
            'border border-neutral-200 px-2 py-0.5 text-caption-m text-neutral-700',
            pill ? 'rounded-full bg-neutral-50' : 'rounded-admin-sm bg-surface-card',
          )}
        >
          {alias}
        </li>
      ))}
    </ul>
  );
}

/** The boards' blue callout (Figma 406:662 "How prompt changes ship"). */
export function InfoAlert({
  title,
  children,
  icon = 'InfoCircle',
  className,
}: {
  title?: string;
  children: ReactNode;
  icon?: AdminIconName;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-md border border-info-600/30 bg-info-50 px-4 py-3.5 text-body-s text-info-600',
        className,
      )}
    >
      <AdminIcon name={icon} className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** An eval score: a tick on green when it passed its threshold, a warning on red when not. */
export function ScoreBadge({ score, passed }: { score: number; passed: boolean }) {
  return (
    <AdminBadge
      tone={passed ? 'success' : 'danger'}
      icon={<AdminIcon name={passed ? 'Check' : 'AlertTriangle'} size="xs" />}
    >
      <span className="sr-only">{passed ? 'Passed, ' : 'Below threshold, '}</span>
      {formatScore(score)}
    </AdminBadge>
  );
}

/** "v9" in a neutral chip. */
export function VersionChip({ version }: { version: number }) {
  return <AdminBadge tone="neutral">v{version}</AdminBadge>;
}
