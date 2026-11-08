import { Tabs } from 'expo-router/js-tabs';
import { memo, type ComponentProps, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { CopiedLinkHost, FirstResumeHost, HomeMenuHost, useHomeStore } from '@/features/home';
import {
  FiltersSheetHost,
  JobSortSheetHost,
  LocationSheetHost,
  useJobsStore,
} from '@/features/jobs';
import { ProfileSheetsHost, ProfileToastHost, useProfileStore } from '@/features/profile';
import {
  ResumeExportHost,
  ResumeMenuHost,
  ResumeSortSheetHost,
  useResumesStore,
} from '@/features/resumes';
import {
  CreateSheetHost,
  CreateSheetProvider,
  Fab,
  FloatingTabBar,
  TabBarScrim,
  TabSceneFade,
  TabWarmup,
  useCreateSheet,
} from '@/navigation';
import { useTheme } from '@/theme';
import { sheetBackgroundA11yProps } from '@/ui/Sheet';

/**
 * Every sheet hosted OVER the chrome (scrim covering the pill and FAB). The create sheet is one
 * of them since the centre button became the assistant (2026-10-04): nothing of the chrome has to
 * stay above it to close it any more.
 */
function useChromeSheetOpen(): boolean {
  const { isOpen: createOpen } = useCreateSheet();
  const filtersOpen = useJobsStore((state) => state.filtersOpen);
  const sortOpen = useJobsStore((state) => state.sortOpen);
  const locationOpen = useJobsStore((state) => state.locationOpen);
  const resumeMenuOpen = useResumesStore((state) => state.menuOpen);
  const resumeSortOpen = useResumesStore((state) => state.sortOpen);
  const exportOpen = useResumesStore((state) => state.exportOpen);
  const profileSheetOpen = useProfileStore((state) => state.sheetOpen);
  const menuOpen = useHomeStore((state) => state.menuOpen);
  const copiedLinkOpen = useHomeStore((state) => state.copiedLinkPhase === 'open');
  return (
    createOpen ||
    filtersOpen ||
    sortOpen ||
    locationOpen ||
    resumeMenuOpen ||
    resumeSortOpen ||
    exportOpen ||
    profileSheetOpen ||
    menuOpen ||
    copiedLinkOpen
  );
}

/**
 * The navigator renders no bar of its own: the pill is a sibling below, so it can paint above
 * the create sheet. Module-level so the prop identity is stable.
 */
const renderNoTabBar = () => null;

/**
 * Wraps every tab scene in the switch fade. Module-level for the same identity reason; the fade
 * lives here rather than in `animation: 'fade'` (see `TabSceneFade`).
 */
const renderTabScene: NonNullable<ComponentProps<typeof Tabs>['screenLayout']> = ({
  navigation,
  route,
  children,
}) => (
  <TabSceneFade navigation={navigation} routeKey={route.key}>
    {children}
  </TabSceneFade>
);

/**
 * Memoised and prop-less so opening the create sheet (which re-renders the wrapper below) never
 * re-renders the navigator itself.
 */
const TabsNavigator = memo(function TabsNavigator() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={renderNoTabBar}
      screenLayout={renderTabScene}
      screenOptions={{
        headerShown: false,
        lazy: true,
        // The page colour behind every tab (§196). Without it the scene falls back to the
        // navigator's default grey (#F2F2F2), which showed through each tab's fade-in.
        sceneStyle: { backgroundColor: colors.surfacePage },
        // No `freezeOnBlur`: Expo Router 58 ignores it. Its replacement, the navigator's
        // `activityEnabled`, unmounts a hidden tab's effects, so it waits for its own pass
        // (toreview §138).
        // No `tabBarStyle`: with a custom `tabBar` the navigator only ever reads `height` off it
        // (to seed BottomTabBarHeightContext), and a `tabBar` returning null occupies no space at
        // all. `Screen`'s `tabBarInset` stays the single source of bottom padding.
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="resumes" options={{ title: 'Resumes' }} />
    </Tabs>
  );
});

/**
 * Everything behind the hosted sheets. While one is open this subtree leaves the accessibility
 * tree on both platforms — a sheet's `accessibilityViewIsModal` only hides its sibling scrim on
 * iOS and is a no-op on Android, so a screen-reader swipe would otherwise walk straight into the
 * tab screens underneath. The pill and the FAB are hidden the same way by `ChromeLayer`.
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
 * Wraps the pill and the FAB so an open sheet can neutralise them.
 *
 * Both are painted *under* every hosted sheet's scrim (JOBS 04 draws the bottom nav before the
 * scrim), but being covered is only a visual fact: without this they would stay focusable and
 * tappable behind the scrim, and the FAB could open the assistant underneath an open sheet.
 */
function ChromeLayer({ children }: PropsWithChildren) {
  const chromeSheetOpen = useChromeSheetOpen();
  const { zIndex } = useTheme();

  return (
    <View
      // `zIndex.sheet`, the same as every Sheet's root: at equal z-index paint order decides, so
      // the hosts after this layer cover it, as JOBS 04 and RESUMES 03 draw, and it still paints
      // over the tab screens and the bottom scrim before it.
      style={[StyleSheet.absoluteFill, { zIndex: zIndex.sheet }]}
      pointerEvents={chromeSheetOpen ? 'none' : 'box-none'}
      {...sheetBackgroundA11yProps(chromeSheetOpen)}
    >
      {children}
    </View>
  );
}

/**
 * Tab shell. Z-order (bottom → top): tab screens → bottom scrim → floating pill → FAB → every
 * hosted sheet (create, filters, menus) with its scrim, which dims the chrome as JOBS 04 draws it
 * (node 1:748 "bottom nav" before the scrim 1:759).
 *
 * The create sheet used to sit under the pill, as CREATE 01/02 drew it, because the FAB turned
 * into its "✕". The FAB is the assistant now (2026-10-04), so the create sheet carries its own ✕
 * and joins the other hosts.
 *
 * `useCreateSheet` must run under the provider, hence the inner `TabsBackdrop`.
 */
export default function TabsLayout() {
  return (
    <CreateSheetProvider>
      <TabsBackdrop />
      <TabWarmup />
      {/* Above the tab screens so it can veil them, below everything else so the create and
          filters scrims still cover it along with the rest of the chrome. */}
      <TabBarScrim />
      <ChromeLayer>
        <FloatingTabBar />
        <Fab />
      </ChromeLayer>
      {/* The create sheet joins them (2026-10-04): the centre button is the assistant now, not
          this sheet's ✕, so nothing of the chrome needs to paint over it. */}
      <CreateSheetHost />
      {/* Last, so their scrims cover the pill and the FAB — the z-order JOBS 04 and
          RESUMES 03 draw. Only one of these can be open at a time (each is raised from its
          own tab), so their order among themselves is moot. */}
      <FiltersSheetHost />
      {/* Raised from the same header row as the filters sheet, so they share its z-order. */}
      <JobSortSheetHost />
      <LocationSheetHost />
      <ResumeMenuHost />
      <ResumeSortSheetHost />
      <HomeMenuHost />
      {/* Home's first-resume pop-up (§185): over the bar, like the menu. */}
      <FirstResumeHost />
      {/* TAILOR 00c's dialog dims the chrome too, as its board draws the nav under the scrim. */}
      <CopiedLinkHost />
      {/* Raised from the same menu, so it shares that z-order; it also owns the library's
          toast, which has to sit above the sheets rather than behind them. */}
      <ResumeExportHost />
      <ProfileSheetsHost />
      {/* Last of all: a toast has to sit above every sheet, including the ones just above. */}
      <ProfileToastHost />
    </CreateSheetProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
