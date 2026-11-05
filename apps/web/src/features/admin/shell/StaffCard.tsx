'use client';

import { useState } from 'react';

import { ADMIN_ROLE_LABEL, type AdminMe } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { signOut } from '@/lib/signOut';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';

import { initialsOf } from '../format';
import { ADMIN_SIGN_IN_PATH } from './adminNav';

/** The staff member's initials on the brand tint, with the online dot (Figma 401:1520). */
export function StaffAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border border-neutral-900/10 bg-brand-100 font-semibold text-brand-700',
        size === 'md' ? 'size-control-md text-body-s' : 'size-9 text-caption-m',
      )}
    >
      {initialsOf(name)}
      {size === 'md' && (
        <span className="absolute -bottom-px -right-px size-2.5 rounded-full bg-success-600 ring-2 ring-surface-card" />
      )}
    </span>
  );
}

/**
 * Who is signed in, and the way out (Figma 401:1519). Sign-out ends the session the same way the
 * user app does (`lib/signOut.ts`).
 */
export function StaffCard({
  me,
  loading,
  error = false,
  onRetry,
}: {
  me: AdminMe | undefined;
  loading: boolean;
  /** `/admin/me` failed: say so, rather than pulsing forever. */
  error?: boolean;
  onRetry?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const { iconRef, hoverProps } = useIconHover();

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-surface-card py-3 pl-3 pr-2 shadow-xs">
      {error && !me ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5" role="alert">
          <span className="text-body-s font-semibold text-neutral-800">
            Couldn’t load your account
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-start rounded-sm text-body-s font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              Try again
            </button>
          )}
        </div>
      ) : loading || !me ? (
        <>
          <Skeleton className="size-control-md rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </>
      ) : (
        <>
          <StaffAvatar name={me.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 animate-reveal">
            <span className="truncate text-body-s font-semibold text-text-primary">{me.name}</span>
            <span className="truncate text-body-s text-text-tertiary">
              {ADMIN_ROLE_LABEL[me.role]}
            </span>
          </div>
        </>
      )}
      <button
        type="button"
        aria-label="Sign out"
        aria-busy={leaving || undefined}
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          // Staff sign back in at the staff sign-in, not the user app's.
          void signOut(ADMIN_SIGN_IN_PATH).finally(() => setLeaving(false));
        }}
        {...hoverProps}
        className={cn(
          'relative flex size-8 shrink-0 after:absolute after:-inset-1.5 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60',
          pressable,
        )}
      >
        <AdminIcon ref={iconRef} name="LogOut01" />
      </button>
    </div>
  );
}
