import { Tabs } from 'expo-router/js-tabs';
import { memo, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { FiltersSheetHost, useJobsStore } from '@/features/jobs';
import { ProfileSheetsHost, useProfileStore } from '@/features/profile';
import { ResumeMenuHost, useResumesStore } from '@/features/resumes';
import {
  CreateSheetHost,
  CreateSheetProvider,
  Fab,
  FloatingTabBar,
  TabBarScrim,
  useCreateSheet,
} from '@/navigation';
import { sheetBackgroundA11yProps } from '@/ui/Sheet';

/**
 * Every sheet hosted OVER the chrome (scrim covering the pill and FAB). The create sheet is
 * absent on purpose: its artboards paint the pill above the sheet.
 */
function useChromeSheetOpen(): boolean {
  const filtersOpen = useJobsStore((state) => state.filtersOpen);
  const resumeMenuOpen = useResumesStore((state) => state.menuOpen);
  const profileSheetOpen = useProfileStore((state) => state.sheetOpen);
  return filtersOpen || resumeMenuOpen || profileSheetOpen;
}

/**
 * The navigator renders no bar of its own: the pill is a sibling below, so it can paint above
 * the create sheet. Module-level so the prop identity is stable.
 */
const renderNoTabBar = () => null;

/**
 * Memoised and prop-less so opening the create sheet (which re-renders the wrapper below) never
 * re-renders the navigator itself.
 */
const TabsNavigator = memo(function TabsNavigator() {
  return (
    <Tabs
      tabBar={renderNoTabBar}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        // No `tabBarStyle`: with a custom `tabBar` the navigator only ever reads `height` off it
        // (to seed BottomTabBarHeightContext), and a `tabBar` returning null occupies no space at
        // all. `Screen`'s `tabBarInset` stays the single source of bottom padding.
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="resumes" options={{ title: 'Resumes' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
});

/**
 * Everything behind the create sheet. While the sheet is open this subtree leaves the
 * accessibility tree on both platforms — the sheet's `accessibilityViewIsModal` only hides its
 * sibling scrim on iOS and is a no-op on Android, so a screen-reader swipe would otherwise walk
 * straight into the tab screens underneath. The pill and the FAB are deliberately NOT inside
 * this wrapper: they paint above the sheet and hide themselves from the a11y tree individually
 * (the FAB stays reachable — its rotated "✕" is the intended dismiss affordance).
 */
function TabsBackdrop() {
  const { isOpen } = useCreateSheet();
  const chromeSheetOpen = useChromeSheetOpen();

  return (
    <View style={styles.fill} {...sheetBackgroundA11yProps(isOpen || chromeSheetOpen)}>
      <TabsNavigator />
    </View>
  );
}

/**
 * Wraps the pill and the FAB so the filters sheet can neutralise them.
 *
 * Both are painted *under* the filters scrim (JOBS 04 draws the bottom nav before the scrim), but
 * being covered is only a visual fact: the FAB carries no background-a11y props of its own — by
 * design, since its rotated "✕" is the create sheet's dismiss control — so without this it would
 * stay focusable behind the scrim and could open the create sheet underneath the filters sheet.
 * Doing it here leaves `Fab` and `FloatingTabBar` untouched and their create-sheet roles intact.
 */
function ChromeLayer({ children }: PropsWithChildren) {
  const chromeSheetOpen = useChromeSheetOpen();

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={chromeSheetOpen ? 'none' : 'box-none'}
      {...sheetBackgroundA11yProps(chromeSheetOpen)}
    >
      {children}
    </View>
  );
}

/**
 * Tab shell. Z-order (bottom → top): tab screens → bottom scrim → create sheet scrim + sheet → floating pill
 * → FAB → filters scrim + sheet. Figma CREATE 01/02 put the pill (nodes 77:226 / 77:290) last in
 * the frame, so it paints undimmed over the create sheet and drops its shadow onto it; the FAB
 * stays above both so its rotated "✕" is the visible dismiss affordance (Figma motion note
 * 1:1364). JOBS 04 inverts that for the filters sheet — node 1:748 "bottom nav" is drawn *before*
 * the scrim (1:759) — so the filters host goes last and dims the chrome instead.
 *
 * `useCreateSheet` must run under the provider, hence the inner `TabsBackdrop`.
 */
export default function TabsLayout() {
  return (
    <CreateSheetProvider>
      <TabsBackdrop />
      {/* Above the tab screens so it can veil them, below everything else so the create and
          filters scrims still cover it along with the rest of the chrome. */}
      <TabBarScrim />
      <CreateSheetHost />
      <ChromeLayer>
        <FloatingTabBar />
        <Fab />
      </ChromeLayer>
      {/* Last, so their scrims cover the pill and the FAB — the z-order JOBS 04 and
          RESUMES 03 draw. Only one of these can be open at a time (each is raised from its
          own tab), so their order among themselves is moot. */}
      <FiltersSheetHost />
      <ResumeMenuHost />
      <ProfileSheetsHost />
    </CreateSheetProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
