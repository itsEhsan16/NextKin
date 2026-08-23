import { Tabs } from 'expo-router/js-tabs';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CreateSheetHost,
  CreateSheetProvider,
  Fab,
  FloatingTabBar,
  useCreateSheet,
} from '@/navigation';
import { sheetBackgroundA11yProps } from '@/ui/Sheet';

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

  return (
    <View style={styles.fill} {...sheetBackgroundA11yProps(isOpen)}>
      <TabsNavigator />
    </View>
  );
}

/**
 * Tab shell. Z-order (bottom → top): tab screens → create sheet scrim + sheet → floating pill
 * → FAB. Figma CREATE 01/02 put the pill (nodes 77:226 / 77:290) last in the frame, so it paints
 * undimmed over the sheet and drops its shadow onto it; the FAB stays above both so its rotated
 * "✕" is the visible dismiss affordance (Figma motion note 1:1364).
 *
 * `useCreateSheet` must run under the provider, hence the inner `TabsBackdrop`.
 */
export default function TabsLayout() {
  return (
    <CreateSheetProvider>
      <TabsBackdrop />
      <CreateSheetHost />
      <FloatingTabBar />
      <Fab />
    </CreateSheetProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
