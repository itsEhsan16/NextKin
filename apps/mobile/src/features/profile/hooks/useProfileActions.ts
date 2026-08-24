import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { PlaceholderKey } from '@/features/placeholders';

import { useProfileStore, type ProfileSheet } from '../profileStore';

/** Every tap target on the Profile screen resolves here, keeping routing out of components. */
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
      editProfile: () => placeholder('profile-edit'),
      openUpgrade: () => placeholder('upgrade'),
      // Career profile rows — the edit flows are undesigned (plan §8).
      openExperience: () => placeholder('profile-experience'),
      openEducation: () => placeholder('profile-education'),
      openSkills: () => placeholder('profile-skills'),
      openCertifications: () => placeholder('profile-certifications'),
      openLinks: () => placeholder('profile-links'),
      openDesiredRoles: () => placeholder('desired-roles'),
      openLocations: () => placeholder('profile-locations'),
      // Preference pickers and confirms are sheets, not routes (plan §Phase 5).
      openMinSalary: sheet('min-salary'),
      openAvailability: sheet('availability'),
      openAppearance: sheet('appearance'),
      openLanguage: sheet('language'),
      signOut: sheet('sign-out'),
      deleteAccount: sheet('delete-account'),
      openNotificationPrefs: () => router.push('/notifications/preferences'),
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
