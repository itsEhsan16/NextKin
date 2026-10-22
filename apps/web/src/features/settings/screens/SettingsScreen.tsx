'use client';

import {
  queryPhase,
  useAccountSecurity,
  useAppSettings,
  useCurrentUser,
  useProfile,
} from '@nextkin/shared/queries';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { replaceQuery } from '@/lib/replaceQuery';
import { useReveal } from '@/lib/useReveal';
import { Reveal } from '@/ui/Reveal';
import { PageHeader } from '@/navigation/PageHeader';
import { ChevronRightIcon } from '@/ui/icons';
import { pageFillMin, pageFrame, stickyBelowTopBar } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AccountInfoCard } from '../components/AccountInfoCard';
import { BillingSection } from '../components/BillingSection';
import { ComingSoonPanel } from '../components/ComingSoonPanel';
import { ConnectedAccountsSection } from '../components/ConnectedAccountsSection';
import { DeleteAccountSection } from '../components/DeleteAccountSection';
import { NotificationPreferences } from '../components/NotificationPreferences';
import { NotificationsIllustration } from '../components/NotificationsIllustration';
import { PasswordCard } from '../components/PasswordCard';
import { PreferencesSection } from '../components/PreferencesSection';
import { PrivacySection } from '../components/PrivacySection';
import { SecurityCheckupCard } from '../components/SecurityCheckupCard';
import { SESSIONS_LIST_ID, SessionsCard } from '../components/SessionsCard';
import { SettingsIllustration } from '../components/SettingsIllustration';
import { SETTINGS_PANEL_ID, SettingsNav, settingsTabId } from '../components/SettingsNav';
import { TwoFactorCard } from '../components/TwoFactorCard';
import { sectionHeading, type SettingsSection } from '../settingsLibrary';

export type SettingsScreenProps = {
  /** The section to open on arrival: `/settings?tab=security`. Account otherwise, as drawn. */
  initialSection?: SettingsSection;
};

/** A section's column of cards, the same gap the panel puts between them. */
const SECTION = 'flex flex-col gap-3';

/**
 * Settings (254:326 Account, 356:2 Preferences, 247:1094 Notifications): the sections down the
 * left, the selected one's cards on the right, and a header that names the section. All eight
 * are drawn now (Security since 554:4027, Billing & plan 470:3, Delete account 467:3); Privacy &
 * data and Connected accounts began as mockups. The coming-soon panel stays for a section added
 * before its board (`toreview.md` §21, §22, §24, §30). Account and Notifications each seat
 * their board's character on the first card.
 *
 * The app-wide top bar sits over the page, as the boards draw it (`toreview.md` §25, §28). The
 * breadcrumb, title and line stand 32px under its buttons and the cards 16px under the line, so the
 * room between the buttons and the first card goes to the section's character, who stands on that
 * card, rather than to a gap under the text. The title keeps its text out of the right-hand corner
 * she takes. It scrolls as a document, as the Profile page does, with the section list held in
 * view under the bar.
 */
export function SettingsScreen({ initialSection = 'account' }: SettingsScreenProps) {
  const [section, setSectionState] = useState<SettingsSection>(initialSection);
  // The address keeps the section, so a refresh or Back returns to it (`toreview.md` §102).
  const setSection = (next: SettingsSection) => {
    setSectionState(next);
    replaceQuery('tab', next);
  };
  const switched = useReveal(true, section);

  const user = useCurrentUser();
  const profile = useProfile();
  const security = useAccountSecurity();
  const appSettings = useAppSettings();

  // Privacy & data's "Active sessions" opens Account, and the button pressed goes with the section
  // it sat in. Focus goes on to the devices it named, or to Account's tab until they have loaded,
  // so a keyboard user isn't dropped at the top of the page.
  const toSessions = useRef(false);
  const accountReady = Boolean(user.data && profile.data && security.data);
  useEffect(() => {
    if (!toSessions.current || section !== 'account') return;
    const devices = document.getElementById(SESSIONS_LIST_ID);
    if (devices || accountReady) toSessions.current = false;
    (devices ?? document.getElementById(settingsTabId('account')))?.focus();
  }, [section, accountReady]);

  // Data first: settings refetch after every saved switch, and one failed refresh used to blank
  // the whole page (`toreview.md` §84).
  if ([user, profile, security, appSettings].some((query) => queryPhase(query) === 'error')) {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your settings. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void user.refetch();
            void profile.refetch();
            void security.refetch();
            void appSettings.refetch();
          }}
        />
      </div>
    );
  }

  const me = user.data;
  const mine = profile.data;
  const safety = security.data;
  const settings = appSettings.data;
  const heading = sectionHeading(section);

  let body: ReactNode;
  if (section === 'account') {
    body = (
      <Reveal
        ready={Boolean(me && mine && safety)}
        className={SECTION}
        fallback={
          <>
            {/* The four cards at their loaded heights (`toreview.md` §84). */}
            <Skeleton className="h-60 rounded-lg" />
            <Skeleton className="h-34 rounded-lg" />
            <Skeleton className="h-34 rounded-lg" />
            <Skeleton className="h-52 rounded-lg" />
          </>
        }
      >
        {me && mine && safety && (
          <>
            <AccountInfoCard user={me} profile={mine} />
            <PasswordCard security={safety} />
            <TwoFactorCard security={safety} />
            <SessionsCard sessions={safety.sessions} />
          </>
        )}
      </Reveal>
    );
  } else if (section === 'preferences') {
    body = (
      <Reveal
        ready={Boolean(mine && settings)}
        className={SECTION}
        fallback={
          <>
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </>
        }
      >
        {mine && settings && (
          <PreferencesSection preferences={mine.preferences} settings={settings} />
        )}
      </Reveal>
    );
  } else if (section === 'notifications') {
    // Loads its own settings, as it does on the Account page's tab.
    body = <NotificationPreferences />;
  } else if (section === 'privacy') {
    // "Active sessions" opens Account, where the devices are listed.
    body = (
      <PrivacySection
        security={safety}
        onOpenAccount={() => {
          toSessions.current = true;
          setSection('account');
        }}
      />
    );
  } else if (section === 'connected') {
    body = <ConnectedAccountsSection />;
  } else if (section === 'security') {
    body = (
      <Reveal
        ready={Boolean(safety)}
        className={SECTION}
        fallback={
          <>
            {/* The four cards at their loaded heights (`toreview.md` §84). */}
            <Skeleton className="h-43 rounded-lg" />
            <Skeleton className="h-34 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-74 rounded-lg" />
          </>
        }
      >
        {safety && (
          <>
            <SecurityCheckupCard security={safety} />
            <PasswordCard security={safety} />
            <TwoFactorCard security={safety} inSecurity />
            <SessionsCard sessions={safety.sessions} inSecurity />
          </>
        )}
      </Reveal>
    );
  } else if (section === 'billing') {
    body = <BillingSection />;
  } else if (section === 'delete') {
    body = <DeleteAccountSection onCancel={() => setSection('account')} />;
  } else {
    body = <ComingSoonPanel section={section} />;
  }

  return (
    <div className={cn(pageFrame, 'flex flex-col pb-8')}>
      <PageHeader
        className="pr-80"
        eyebrow={
          <span className="flex items-center gap-1.5">
            Settings
            <ChevronRightIcon aria-hidden className="size-3.5" />
          </span>
        }
        title={heading.title}
        subtitle={heading.subtitle}
      />

      <div className="mt-4 grid grid-cols-[264px_minmax(0,1fr)] items-start gap-5">
        <SettingsNav
          active={section}
          onChange={setSection}
          className={cn('sticky', stickyBelowTopBar)}
        />

        <div
          role="tabpanel"
          id={SETTINGS_PANEL_ID}
          aria-labelledby={settingsTabId(section)}
          className="@container relative flex min-w-0 flex-col gap-3"
        >
          {/* Account's character stands on the first card of every redrawn section but
              Preferences and Notifications (466:58, 554:3548, 470:4, 467:4). */}
          {(section === 'account' ||
            section === 'privacy' ||
            section === 'connected' ||
            section === 'security' ||
            section === 'billing' ||
            section === 'delete') && (
            <SettingsIllustration className="absolute bottom-full right-2.5 animate-reveal" />
          )}
          {section === 'notifications' && (
            <NotificationsIllustration className="absolute bottom-full right-[16%] animate-reveal" />
          )}
          {/* Keyed by section: after the first switch, each section fades in (`toreview.md` §84). */}
          <div key={section} className={cn('flex flex-col gap-3', switched && 'animate-reveal')}>
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
