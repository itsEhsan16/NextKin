'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Spinner } from '@/ui/Spinner';

import { adminButton } from '../ui/adminButton';

/** The staff sign-in card's pieces (Figma 410:1605), shared by its three steps. */

/**
 * The board's backdrop (Figma 411:1664–411:1712): a 56px slate grid fading out from the middle,
 * and a soft indigo glow above the card. Decorative.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      <div className="absolute -top-40 h-[1000px] w-[1600px] bg-[linear-gradient(to_right,var(--color-neutral-300)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-neutral-300)_1px,transparent_1px)] bg-[size:56px_56px] bg-[position:16px_52px] [mask-image:radial-gradient(ellipse_55%_55%_at_50%_50%,black_0%,color-mix(in_srgb,black_50%,transparent)_60%,transparent_100%)]" />
      <div className="absolute -top-[340px] h-[760px] w-[1300px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-brand-500)_32%,transparent),transparent)]" />
    </div>
  );
}

export function Heading({
  icon,
  title,
  text,
}: {
  icon: AdminIconName;
  title: string;
  text: string;
}) {
  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-admin-md border border-neutral-200 bg-surface-card text-neutral-700 shadow-xs">
        <AdminIcon name={icon} />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 id="signin-title" className="text-admin-h1 text-text-primary">
          {title}
        </h1>
        <p className="text-body-m text-text-secondary">{text}</p>
      </div>
    </>
  );
}

export function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className={cn(adminButton.primary, 'w-full')}
    >
      {busy && <Spinner className="size-4" />}
      {label}
    </button>
  );
}

export function LinkButton({
  icon,
  tone = 'neutral',
  onClick,
  children,
}: {
  icon?: AdminIconName;
  tone?: 'brand' | 'neutral';
  onClick: () => void;
  children: ReactNode;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      className={cn(
        // Drawn 36px tall; the overlay takes the hit area to 44 (§171.3).
        'relative flex min-h-9 items-center gap-1.5 rounded-sm py-2 text-body-s font-semibold transition-colors duration-press after:absolute after:-inset-y-1 after:inset-x-0 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600',
        tone === 'brand' ? 'text-brand-700' : 'text-text-secondary',
      )}
    >
      {icon && <AdminIcon ref={iconRef} name={icon} />}
      {children}
    </button>
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="-mt-2 w-full text-center text-body-s text-danger-600">
      {children}
    </p>
  );
}
