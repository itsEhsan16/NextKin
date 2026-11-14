'use client';

import { queryPhase, useCurrentUser, useProfile } from '@nextkin/shared/queries';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { replaceQuery } from '@/lib/replaceQuery';
import { useReveal } from '@/lib/useReveal';
import { PageHeader } from '@/navigation/PageHeader';
import { ChevronRightIcon } from '@/ui/icons';
import { pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AboutCard } from '../components/AboutCard';
import { CareerPreferencesCard } from '../components/CareerPreferencesCard';
import { CompletionCard } from '../components/CompletionCard';
import { EducationCard } from '../components/EducationCard';
import { ExperienceCard } from '../components/ExperienceCard';
import { KeyInfoCard } from '../components/KeyInfoCard';
import { ProfileInfoCard } from '../components/ProfileInfoCard';
import { PROFILE_PANEL_ID, ProfileTabs, profileTabId } from '../components/ProfileTabs';
import { SkillsCard } from '../components/SkillsCard';
import { SocialLinksCard } from '../components/SocialLinksCard';
import { OpportunitiesCard, SuggestionsCard } from '../components/SuggestionsCard';
import { OVERVIEW_ROLES, OVERVIEW_SKILLS, type ProfileTab } from '../profileLibrary';

export type ProfileScreenProps = {
  /** The section to open on arrival: `/profile?tab=skills`. Overview otherwise, as drawn. */
  initialTab?: ProfileTab;
};

/**
 * "Your profile" (476:4), which replaced the Account page (307:3443) and took its place behind
 * the top bar's avatar and the sidebar's user chip. The sections as tabs; Overview draws every
 * section's card, the profile card across the top and the rest in two columns under it, and each
 * other tab opens its own card in full. Completion, the AI suggestions and why it matters sit on
 * the right throughout.
 *
 * It scrolls as a document, as Home does, and starts in the top bar's band as Home does
 * (`toreview.md` §87, §91). The account-wide sections Account carried (plan, security,
 * notifications…) live in Settings.
 */
export function ProfileScreen({ initialTab = 'overview' }: ProfileScreenProps) {
  const [tab, setTabState] = useState<ProfileTab>(initialTab);
  // The address keeps the tab, so a refresh or Back returns to it (`toreview.md` §102).
  const setTab = (next: ProfileTab) => {
    setTabState(next);
    replaceQuery('tab', next);
  };
  const switched = useReveal(true, tab);

  const user = useCurrentUser();
  const profile = useProfile();
  // The first load fades in too, not only a tab switch (`toreview.md` §102).
  const loaded = useReveal(Boolean(user.data && profile.data));

  if (queryPhase(user) === 'error' || queryPhase(profile) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your profile. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void user.refetch();
            void profile.refetch();
          }}
        />
      </div>
    );
  }

  const me = user.data;
  const mine = profile.data;

  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-6 pb-10')}>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            Profile
            <ChevronRightIcon aria-hidden className="size-3.5" />
          </span>
        }
        title="Your profile"
        subtitle="Showcase your skills, experience, and aspirations. A stronger profile leads to better opportunities."
      />

      <ProfileTabs active={tab} onChange={setTab} />

      <div className="grid grid-cols-[minmax(0,1fr)_var(--spacing-aside-rail)] items-start gap-6">
        {/* Keyed by tab: after the first switch, each tab fades in (`toreview.md` §84). */}
        <div
          key={tab}
          role="tabpanel"
          id={PROFILE_PANEL_ID}
          aria-labelledby={profileTabId(tab)}
          className={cn('flex min-w-0 flex-col gap-6', (switched || loaded) && 'animate-reveal')}
        >
          {!me || !mine ? (
            <>
              {/* Overview's cards, at their loaded heights (`toreview.md` §84). */}
              <Skeleton className="h-62 rounded-lg" />
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-96 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
              </div>
            </>
          ) : (
            <>
              {tab === 'overview' && (
                <>
                  <ProfileInfoCard user={me} profile={mine} />
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-6">
                    <div className="flex min-w-0 flex-col gap-6">
                      <AboutCard profile={mine} />
                      <ExperienceCard
                        roles={mine.experiences.slice(0, OVERVIEW_ROLES)}
                        onViewAll={() => setTab('experience')}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-6">
                      <KeyInfoCard profile={mine} />
                      <SkillsCard
                        skills={mine.skills}
                        limit={OVERVIEW_SKILLS}
                        onViewAll={() => setTab('skills')}
                      />
                      <CareerPreferencesCard profile={mine} />
                      <SocialLinksCard profile={mine} />
                    </div>
                  </div>
                </>
              )}
              {tab === 'experience' && <ExperienceCard roles={mine.experiences} detailed />}
              {tab === 'education' && <EducationCard education={mine.education} />}
              {tab === 'skills' && <SkillsCard skills={mine.skills} />}
              {tab === 'preferences' && <CareerPreferencesCard profile={mine} />}
              {tab === 'links' && <SocialLinksCard profile={mine} />}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {me && mine ? (
            <div className={cn(loaded && 'animate-reveal')}>
              <CompletionCard user={me} profile={mine} sweep={loaded} onOpenTab={setTab} />
            </div>
          ) : (
            <Skeleton className="h-110 rounded-lg" />
          )}
          <SuggestionsCard profile={profile.data} />
          <OpportunitiesCard />
        </div>
      </div>
    </div>
  );
}
