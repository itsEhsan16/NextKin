import { Stack } from 'expo-router/stack';

import { useSessionStore } from '@/features/auth';
import { ApplyAskHost } from '@/features/jobs';
import { AccuracyConfirmHost } from '@/features/resumes';
import { useStackAnimation } from '@/navigation';
import { AppProviders, useAppReady } from '@/providers';
import { useTheme } from '@/theme';

/** Deep links into nested routes still get the tabs as their back target. */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { ready } = useAppReady();
  const { colors } = useTheme();
  const animation = useStackAnimation();
  // Read above the early return — hooks cannot be conditional. There is no loading state to add
  // for it: the store's initial value comes from synchronous storage, so the first frame is
  // already on the right side of the gate.
  const signedIn = useSessionStore((state) => state.status) === 'signed_in';

  // Splash stays up until fonts are ready; rendering nothing avoids a system-font flash.
  if (!ready) return null;

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          animation,
          contentStyle: { backgroundColor: colors.surfacePage },
        }}
      >
        {/*
          Every signed-in route, enumerated rather than left to file-system discovery. A route
          that is not declared inside a guard stays reachable, so a deep link (nextkin://jobs/j1,
          a notification tap) would push a job detail on top of the sign-in screen. Later phases
          register their routes here too.

          +not-found belongs in here for the same reason plus one of its own: it catches every
          unmatched path, and its only way out is a link to '/', which is guarded away when signed
          out — left reachable it would strand the user. Guarded, an unmatched link signed out has
          no route left to rehydrate and falls back to the first declared screen, (auth).
        */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="jobs/[id]/index" />
          <Stack.Screen name="jobs/[id]/company" />
          <Stack.Screen name="jobs/[id]/criteria" />
          <Stack.Screen name="notifications/index" />
          <Stack.Screen name="notifications/preferences" />
          <Stack.Screen name="resumes/[id]/index" />
          <Stack.Screen name="resumes/[id]/edit/[section]" />
          <Stack.Screen name="resumes/[id]/fix" />
          <Stack.Screen name="resumes/[id]/score" />
          <Stack.Screen name="resumes/[id]/rubric" />
          <Stack.Screen name="resumes/[id]/versions" />
          <Stack.Screen name="create/tailor" />
          <Stack.Screen name="create/build/index" />
          <Stack.Screen name="create/build/jobs" />
          <Stack.Screen name="create/build/add" />
          <Stack.Screen name="create/build/review" />
          <Stack.Screen name="create/build/compare" />
          <Stack.Screen name="create/build/unreadable" />
          <Stack.Screen name="create/jd" />
          <Stack.Screen name="create/jd-review" />
          <Stack.Screen name="create/cover-letter" />
          <Stack.Screen name="create/ats-check" />
          <Stack.Screen name="create/zero-resume" />
          <Stack.Screen name="create/start" />
          <Stack.Screen name="create/upload" />
          <Stack.Screen name="create/upload-review" />
          <Stack.Screen name="create/import-linkedin" />
          <Stack.Screen name="resumes/new" />
          <Stack.Screen name="generations/[id]" />
          <Stack.Screen name="upgrade" />
          <Stack.Screen name="history" />
          <Stack.Screen name="interview/index" />
          <Stack.Screen name="interview/new" />
          <Stack.Screen name="interview/[id]" />
          <Stack.Screen name="assistant" />
          <Stack.Screen name="support/help" />
          <Stack.Screen name="support/contact" />
          <Stack.Screen name="legal/[doc]" />
          <Stack.Screen name="account/email" />
          <Stack.Screen name="account/export" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/skills" />
          <Stack.Screen name="profile/desired-roles" />
          <Stack.Screen name="profile/locations" />
          <Stack.Screen name="profile/experience/index" />
          <Stack.Screen name="profile/experience/[id]" />
          <Stack.Screen name="profile/education/index" />
          <Stack.Screen name="profile/education/[id]" />
          <Stack.Screen name="profile/certifications/index" />
          <Stack.Screen name="profile/certifications/[id]" />
          <Stack.Screen name="profile/links/index" />
          <Stack.Screen name="profile/links/[id]" />
          <Stack.Screen name="+not-found" />
        </Stack.Protected>

        {/*
          Order dependency, and it is invisible: `unstable_settings.anchor` names '(tabs)', which
          signed in is present and becomes the initial route. Signed out the anchor is guarded
          away and expo-router falls back to the FIRST screen still declared here — so (auth) has
          to come before the __DEV__ block. Swap the two and a dev build would launch a
          signed-out user into the dev gallery.
        */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        {/* Keep last, for the fallback ordering explained above. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev" />
        </Stack.Protected>
      </Stack>
      {/* Above every screen: an export from the tabs, the editor or a finished run asks here. */}
      {signedIn ? <AccuracyConfirmHost /> : null}
      {signedIn ? <ApplyAskHost /> : null}
    </AppProviders>
  );
}
