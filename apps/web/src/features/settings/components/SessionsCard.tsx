import type { AccountSession, SessionDevice } from '@nextkin/shared/models';
import { useSignOutEverywhere } from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { iconButton } from '@/ui/iconButton';
import { LogoutIcon, MoreVerticalIcon } from '@/ui/icons';
import {
  SettingsDevicePhoneIllustration,
  SettingsDeviceTabletIllustration,
  SettingsSessionsIllustration,
} from '@/ui/illustrations';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';

import { sessionActivity, sessionName } from '../settingsLibrary';
import { CardAction } from './CardAction';
import { StableLabel } from '@/ui/StableLabel';
import { Soon, soonControl } from '@/ui/Soon';

/** The device list's id: Privacy & data's "Active sessions" puts focus here. */
export const SESSIONS_LIST_ID = 'settings-sessions';

/**
 * The row glyphs, duotone since the redraw (356:468-490): the board draws a tablet beside
 * "Windows • Edge", and the card's own monitor beside this device.
 */
const DEVICE_ICON: Record<SessionDevice, ComponentType<SVGProps<SVGSVGElement>>> = {
  desktop: SettingsSessionsIllustration,
  phone: SettingsDevicePhoneIllustration,
  tablet: SettingsDeviceTabletIllustration,
};

/**
 * "Active sessions" (254:555): every signed-in device, this one marked green and named, the rest
 * with when they were last used and a menu. The board draws neither the menu open nor a longer
 * list behind "View all", so both say "Coming soon" (`toreview.md` §21, §102). "Sign out of other
 * devices" in Settings → Security does end the others, and this list follows it.
 */
export function SessionsCard({
  sessions,
  inSecurity = false,
}: {
  sessions: AccountSession[];
  /**
   * The Security section's card (577:4262): this device's line as a pill, and "Sign out of
   * other devices" under the list.
   */
  inSecurity?: boolean;
}) {
  const signOut = useSignOutEverywhere();
  const others = sessions.some((session) => !session.current);

  return (
    <AccountCard
      Art={SettingsSessionsIllustration}
      title="Active sessions"
      description="Manage your logged-in devices."
      action={<CardAction label="View all" accessibleName="View all sessions" />}
    >
      {sessions.length === 0 ? (
        <StateView
          title="No active sessions"
          message="Devices you sign in on will show up here."
          className="py-6"
        />
      ) : (
        <ul
          id={SESSIONS_LIST_ID}
          tabIndex={-1}
          aria-label="Signed-in devices"
          className="mt-3 divide-y divide-border-faint rounded-sm border border-border-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {sessions.map((session) => {
            const Icon = DEVICE_ICON[session.device];
            return (
              <li
                key={session.id}
                className="grid min-h-9 grid-cols-[28px_minmax(0,9rem)_minmax(0,1fr)_auto_30px] items-center gap-3 px-3"
              >
                <span aria-hidden className="flex justify-center">
                  <Icon className="h-auto max-h-5 w-7" />
                </span>
                <span className="truncate text-body-m text-text-secondary">
                  {sessionName(session)}
                </span>
                <span className="flex min-w-0 items-center gap-2.5 text-body-m text-text-secondary">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      session.current ? 'bg-success-600' : 'bg-neutral-400',
                    )}
                  />
                  <span className="truncate">{session.location}</span>
                </span>
                {inSecurity && session.current ? (
                  <Tag tone="brand" shape="pill" className="justify-self-end">
                    {sessionActivity(session)}
                  </Tag>
                ) : (
                  <span
                    className={cn(
                      'whitespace-nowrap text-right text-body-m',
                      session.current ? 'text-brand-600' : 'text-text-tertiary',
                    )}
                  >
                    {sessionActivity(session)}
                  </span>
                )}
                {session.current ? (
                  <span aria-hidden />
                ) : (
                  <Soon>
                    <button
                      aria-disabled="true"
                      type="button"
                      aria-label={`Options for ${session.platform} ${session.browser}`}
                      className={cn(soonControl, iconButton, 'text-text-secondary')}
                    >
                      <MoreVerticalIcon aria-hidden className="size-4" />
                    </button>
                  </Soon>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {inSecurity && others && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-disabled={signOut.isPending}
            onClick={() => {
              if (!signOut.isPending) signOut.mutate();
            }}
            className={cn(
              brandOutlineButton,
              'h-control-md gap-2 rounded-md px-4 text-body-m aria-disabled:cursor-default aria-disabled:opacity-60',
            )}
          >
            <LogoutIcon aria-hidden className="size-4" />
            <StableLabel
              label="Sign out of other devices"
              busyLabel="Signing out…"
              busy={signOut.isPending}
            />
          </button>
          <span className="text-body-s text-text-tertiary">
            Ends every session except this one.
          </span>
        </div>
      )}
    </AccountCard>
  );
}
