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
 * Memoised and prop-less so opening the create sheet (which re-renders the wrapper below) never
 * re-renders the navigator itself.
 */
const TabsNavigator = memo(function TabsNavigator() {
  return (
    <Tabs
      tabBar={FloatingTabBar}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        // No `tabBarStyle`: with a custom `tabBar` the navigator only ever reads `height` off it
        // (to seed BottomTabBarHeightContext) — `position: 'absolute'` there was inert. The bar
        // positions itself absolutely, so it reserves no layout space, and `Screen`'s
        // `tabBarInset` stays the single source of bottom padding.
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
 * straight into the tab screens underneath. The FAB is deliberately NOT inside this wrapper: its
 * rotated "✕" is the intended dismiss affordance and must stay reachable.
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
 * Tab shell. Z-order (bottom → top): tab screens → floating pill (rendered by the navigator)
 * → create sheet scrim + sheet → FAB. The FAB stays above the scrim so its rotated "✕" is
 * the visible dismiss affordance (Figma motion note).
 *
 * `useCreateSheet` must run under the provider, hence the inner `TabsBackdrop`.
 */
export default function TabsLayout() {
  return (
    <CreateSheetProvider>
      <TabsBackdrop />
      <CreateSheetHost />
      <Fab />
    </CreateSheetProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
