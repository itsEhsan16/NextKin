'use client';

import { useCurrentUser } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { signOut } from '@/lib/signOut';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { LogoutIcon, PersonIcon, SettingsIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { UserAvatar } from '@/ui/UserAvatar';

/**
 * The avatar's menu (owner, 2026-11-04, toreview §164): who is signed in, the way to Profile and
 * Settings, and Sign out — which the app had nowhere before.
 */
export function AccountMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const name = user.data ? `${user.data.firstName} ${user.data.lastName}`.trim() : '';

  const leave = () => {
    setLeaving(true);
    void signOut().finally(() => setLeaving(false));
  };

  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Your account"
          className={cn(
            'shrink-0 rounded-full hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            pressable,
          )}
        >
          <UserAvatar
            name={name}
            avatarUrl={user.data?.avatarUrl}
            className="size-control-md rounded-full"
          />
        </button>
      }
    >
      {user.data && (
        <div className="mb-1 border-b border-border-subtle px-3 pb-2.5 pt-1.5">
          <p className="truncate text-body-m font-semibold text-text-primary">{name}</p>
          <p className="truncate text-body-s text-text-tertiary">{user.data.email}</p>
        </div>
      )}
      <MenuItem onSelect={() => router.push('/profile')}>
        <PersonIcon aria-hidden className="size-4 text-text-tertiary" />
        Profile
      </MenuItem>
      <MenuItem onSelect={() => router.push('/settings')}>
        <SettingsIcon aria-hidden className="size-4 text-text-tertiary" />
        Settings
      </MenuItem>
      <MenuItem onSelect={leave} disabled={leaving} tone="danger">
        <LogoutIcon aria-hidden className="size-4" />
        {leaving ? 'Signing out…' : 'Sign out'}
      </MenuItem>
    </FilterDropdown>
  );
}
