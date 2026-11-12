'use client';

import type { ConnectedAccount, ConnectedProvider } from '@nextkin/shared/models';
import {
  useConnectAccount,
  useConnectedAccounts,
  useDisconnectAccount,
} from '@nextkin/shared/queries';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { brandButton } from '@/ui/brandButton';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { iconButton } from '@/ui/iconButton';
import { ArrowRightIcon, MoreVerticalIcon } from '@/ui/icons';
import {
  LogoGoogleIllustration,
  SettingsAccountIllustration,
  SettingsConnectedIllustration,
  SettingsPasswordIllustration,
  SettingsPreferencesIllustration,
  SettingsPrivacyIllustration,
} from '@/ui/illustrations';
import { outlineButton } from '@/ui/outlineButton';
import { Skeleton } from '@/ui/Skeleton';
import { StableLabel } from '@/ui/StableLabel';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';

import { CONNECTED_PROVIDER } from '../settingsLibrary';
import { useReveal } from '@/lib/useReveal';
import { Soon, soonControl } from '@/ui/Soon';

const ACTION = 'h-control-md min-w-24 shrink-0 rounded-md px-5 text-body-m';

const link =
  'rounded-sm text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

/** Each provider's mark: Google's is the four-colour G the Home board draws (286:180). */
const LOGO: Record<ConnectedProvider, ComponentType<SVGProps<SVGSVGElement>>> = {
  google: LogoGoogleIllustration,
};

function AccountRow({ account }: { account: ConnectedAccount }) {
  const connect = useConnectAccount();
  const disconnect = useDisconnectAccount();
  const { name, line } = CONNECTED_PROVIDER[account.provider];
  const Logo = LOGO[account.provider];

  // The control a person pressed goes away when the row flips, so focus follows to the one that
  // takes its place: Manage once linked, Connect once unlinked. Only after their own press, so a
  // refetch never moves focus. A failed change leaves the row, and focus, where they were.
  const refocus = useRef(false);
  const connectRef = useRef<HTMLButtonElement>(null);
  const manageRef = useRef<HTMLButtonElement>(null);
  // Connecting or disconnecting swaps the row's controls; the new ones grow in (§102).
  const swapped = useReveal(true, account.connected ? 'connected' : 'not');
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (account.connected ? manageRef : connectRef).current?.focus();
  }, [account.connected]);
  const keepFocus = {
    onError: () => {
      refocus.current = false;
    },
  };

  return (
    <li className="rounded-md bg-neutral-50 px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card shadow-card"
        >
          <Logo className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-l text-text-primary">{name}</p>
          <p className="text-body-s text-text-tertiary">{line}</p>
        </div>
        {account.connected ? (
          <div className={cn('flex items-center gap-1', swapped && 'animate-pop-in')}>
            {/* Drawn with nothing behind it: no mockup says what managing a sign-in account shows. */}
            <Soon>
              <button
                aria-disabled="true"
                ref={manageRef}
                type="button"
                aria-label={`Manage ${name}`}
                className={cn(soonControl, outlineButton, ACTION)}
              >
                Manage
              </button>
            </Soon>
            <FilterDropdown
              align="end"
              trigger={
                <button
                  type="button"
                  aria-label={`More options for ${name}`}
                  className={cn(iconButton, 'text-text-secondary')}
                >
                  <MoreVerticalIcon aria-hidden className="size-4" />
                </button>
              }
            >
              <MenuItem
                tone="danger"
                onSelect={() => {
                  refocus.current = true;
                  disconnect.mutate(account.provider, keepFocus);
                }}
              >
                Disconnect {name}
              </MenuItem>
            </FilterDropdown>
          </div>
        ) : (
          // Stays focusable while it works (`aria-disabled`, not `disabled`), so a keyboard user
          // keeps their place: a disabled button drops focus to the page.
          <button
            ref={connectRef}
            type="button"
            aria-label={`Connect ${name}`}
            aria-disabled={connect.isPending}
            onClick={() => {
              if (connect.isPending) return;
              refocus.current = true;
              connect.mutate(account.provider, keepFocus);
            }}
            className={cn(
              brandButton,
              ACTION,
              'aria-disabled:cursor-default aria-disabled:opacity-60',
              swapped && 'animate-pop-in',
            )}
          >
            <StableLabel label="Connect" busyLabel="Connecting…" busy={connect.isPending} />
          </button>
        )}
      </div>

      {/* "Sign in with Google" (577:2388): what linking it changes about signing in. */}
      <div className="mt-4 flex items-center gap-4 border-t border-border-subtle pt-4">
        <span aria-hidden className="flex w-12 shrink-0 justify-center">
          <SettingsPasswordIllustration className="h-auto w-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-m text-text-primary">Sign in with {name}</p>
          <p className="text-body-s text-text-tertiary">
            {account.connected
              ? `You can sign in with ${name} or with your email and password.`
              : 'You sign in with your email and password today.'}
          </p>
        </div>
        {account.connected ? (
          // The success tone's own ink is about 3:1 on its tint, and this pill is the row's one
          // word for its state, so it takes the darker success ink the match badges use (4.6:1).
          <Tag tone="success" shape="pill" className="gap-1.5 text-success-text">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            Connected
          </Tag>
        ) : (
          <Tag tone="neutral" shape="pill" className="gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            Not connected
          </Tag>
        )}
      </div>
    </li>
  );
}

/** "How connecting works" (577:2417-2443): three points, each with its duotone glyph. */
const POINTS: readonly {
  title: string;
  line: ReactNode;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    title: 'We only access the information you permit.',
    line: (
      <Link href="/help" className={link}>
        Learn more about how we use your data.
      </Link>
    ),
    Art: SettingsPrivacyIllustration,
  },
  {
    title: 'One account, two ways in',
    line: 'Google sign-in links to your existing account when the email matches.',
    Art: SettingsAccountIllustration,
  },
  {
    title: 'You stay in control',
    line: 'Disconnect Google from this page at any time.',
    Art: SettingsPreferencesIllustration,
  },
];

/**
 * "How connecting works" (577:2408): the checkout drawing mobile's BILLING 02 opens on (a page
 * behind a padlock, 680:95), and what linking an account does and doesn't let NextKin see.
 */
function HowItWorksCard() {
  return (
    <section
      aria-labelledby="how-connecting-works"
      className={cn(cardSurface, cardPad, 'flex flex-wrap items-center gap-x-8 gap-y-4')}
    >
      <div aria-hidden className="flex h-44 w-64 shrink-0 items-center justify-center">
        <Image
          src="/illustrations/v2/connected.webp"
          alt=""
          width={560}
          height={304}
          className="h-auto w-56 object-contain"
        />
      </div>
      <div className="min-w-0 flex-1 basis-80">
        <h2 id="how-connecting-works" className="text-title-l font-medium text-text-primary">
          How connecting works
        </h2>
        <p className="mt-0.5 text-body-s text-text-tertiary">
          What NextKin can see, and how to undo it.
        </p>
        <ul className="mt-4 flex flex-col gap-3.5">
          {POINTS.map(({ title, line, Art }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span aria-hidden className="flex w-9 shrink-0 justify-center">
                <Art className="h-auto max-h-7 w-9" />
              </span>
              <span className="min-w-0">
                <span className="block text-body-m text-text-primary">{title}</span>
                <span className="block text-body-s text-text-tertiary">{line}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/help"
          className={cn(link, 'mt-4 inline-flex items-center gap-1.5 text-body-s')}
        >
          View privacy policy
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/**
 * "Settings → Connected accounts", built from your mockup and redrawn as 554:3547: the Google card
 * with its sign-in status under it, then how connecting works. By your call it follows V2 rather
 * than the mockup's six providers: V2 §7.1 lets a user sign in with Google or Apple, and the
 * mockup draws Google, so Google is the one row. Connect and Disconnect change the mock only; the
 * real client sends the person through Google's sign-in and Cognito links the account. "Manage"
 * has nothing drawn behind it and is inert, and the explainer's two links open Help &
 * support, whose policy cards link the legal pages (`toreview.md` §30).
 */
export function ConnectedAccountsSection() {
  const accounts = useConnectedAccounts();
  const reveal = useReveal(accounts.data != null);

  if (accounts.isPending) {
    // The two cards at their loaded heights (`toreview.md` §102).
    return (
      <>
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </>
    );
  }
  // A failed refetch keeps the list it had, so the error shows only when there is none.
  if (!accounts.data) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load your connected accounts"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void accounts.refetch()}
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', reveal && 'animate-reveal')}>
      <AccountCard
        Art={SettingsConnectedIllustration}
        title="Connected accounts"
        description="Link your accounts to sync data and unlock more features."
      >
        {accounts.data.length === 0 ? (
          <StateView
            title="No accounts to connect"
            message="Accounts you can sign in with will show up here."
            className="py-6"
          />
        ) : (
          <ul aria-label="Sign-in accounts" className="mt-5 flex flex-col gap-3">
            {accounts.data.map((account) => (
              <AccountRow key={account.provider} account={account} />
            ))}
          </ul>
        )}
      </AccountCard>
      <HowItWorksCard />
    </div>
  );
}
