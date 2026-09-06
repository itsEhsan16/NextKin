import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';
import type { PlaceholderKey } from '@/features/placeholders';

import { useProfileStore, type ProfileSheet } from '../profileStore';

/** Every tap target on the Profile screens resolves here, keeping routing out of components. */
export function useProfileActions() {
  const router = useRouter();
  const openSheet = useProfileStore((state) => state.openSheet);

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  const sheet = useCallback((kind: ProfileSheet) => () => openSheet(kind), [openSheet]);

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
      goBack: () => router.back(),
      // Support, legal and account rows are still undesigned (plan §8, Phase 9G).
      openHelp: () => placeholder('help'),
      openContact: () => placeholder('contact'),
      openRate: () => placeholder('rate'),
      openTerms: () => placeholder('terms'),
      openPrivacy: () => placeholder('privacy'),
      openAccountEmail: () => placeholder('account-email'),
      openExportData: () => placeholder('account-export'),
    }),
    [placeholder, router, sheet],
  );
}
