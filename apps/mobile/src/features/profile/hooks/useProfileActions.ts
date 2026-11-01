import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';
import { requestStoreReview } from '@/lib';

import { NEXT_STEP } from '../nextSteps';
import { useProfileStore, type ProfileSheet } from '../profileStore';
import { showAppToast } from '@/ui/Toast';

/**
 * `requestStoreReview` is a no-op in Expo Go and silently rate-limited even in a store build —
 * the OS decides whether the prompt appears and never says. So the tap always confirms something
 * rather than looking broken on the run where the OS stays quiet.
 */
export const RATE_REQUESTED = 'Thanks — the rating prompt is up to your app store';
export const RATE_UNAVAILABLE = 'Rating opens once the app is on the store';

/** Every tap target on the Profile screens resolves here, keeping routing out of components. */
export function useProfileActions() {
  const router = useRouter();
  const openSheet = useProfileStore((state) => state.openSheet);

  const sheet = useCallback((kind: ProfileSheet) => () => openSheet(kind), [openSheet]);

  const showToast = useProfileStore((state) => state.showToast);
  const rate = useCallback(() => {
    void requestStoreReview().then((result) => {
      if (result === 'requested') showToast(RATE_REQUESTED);
      else showToast(RATE_UNAVAILABLE, 'info');
    });
  }, [showToast]);

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      editProfile: () => router.push('/profile/edit'),
      /** §13.5: a gated control names the limit it hit rather than opening a generic pitch. */
      openUpgrade: (reason?: UpgradeReason) =>
        router.push(reason ? { pathname: '/upgrade', params: { reason } } : '/upgrade'),
      // Career profile rows (V2 §7.3) — each row is a list or a form of its own.
      openExperience: () => router.push('/profile/experience'),
      openEducation: () => router.push('/profile/education'),
      openSkills: () => router.push('/profile/skills'),
      openGapInterview: () => router.push('/profile/questions'),
      openCertifications: () => router.push('/profile/certifications'),
      openLinks: () => router.push('/profile/links'),
      openDesiredRoles: () => router.push('/profile/desired-roles'),
      openLocations: () => router.push('/profile/locations'),
      /** A list row opens the entry it names; 'new' is the same form with nothing in it. */
      openExperienceEntry: (id: string) =>
        router.push({ pathname: '/profile/experience/[id]', params: { id } }),
      openEducationEntry: (id: string) =>
        router.push({ pathname: '/profile/education/[id]', params: { id } }),
      openCertificationEntry: (id: string) =>
        router.push({ pathname: '/profile/certifications/[id]', params: { id } }),
      openLinkEntry: (id: string) =>
        router.push({ pathname: '/profile/links/[id]', params: { id } }),
      // Preference pickers and confirms are sheets, not routes (plan §Phase 5).
      openMinSalary: sheet('min-salary'),
      openAvailability: sheet('availability'),
      openAppearance: sheet('appearance'),
      openLanguage: sheet('language'),
      signOut: sheet('sign-out'),
      deleteAccount: sheet('delete-account'),
      openNotificationPrefs: () => router.push('/notifications/preferences'),
      /**
       * A completeness chip opens the editor that answers it rather than ticking itself off (§85).
       * The step leaves when its data is saved: the skills write drops "Add skills" (profileRepo),
       * a salary floor drops "Set salary range" (ProfileSheetsHost). See `nextStepHint`.
       */
      openNextStep: (id: string) => {
        if (id === NEXT_STEP.skills) router.push('/profile/skills');
        else if (id === NEXT_STEP.salary) openSheet('min-salary');
        else router.push('/profile/edit');
      },
      goBack: () => router.back(),
      /**
       * Back to where the editor was opened from, then say what happened there. A save used to
       * pop the form in silence, so a change looked the same as a cancel (§85).
       */
      backWith: (message: string) => {
        router.back();
        showAppToast(message);
      },
      // Support, legal and account (PROFILE 02 Support rows; V2 §7.1, §8.5).
      openHelp: () => router.push('/support/help'),
      openContact: () => router.push('/support/contact'),
      /** No screen: the OS owns the prompt, so this asks and then says what happened. */
      openRate: rate,
      openTerms: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } }),
      openPrivacy: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } }),
      openAccountEmail: () => router.push('/account/email'),
      openExportData: () => router.push('/account/export'),
    }),
    [openSheet, rate, router, sheet],
  );
}
