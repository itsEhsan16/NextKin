import { FontAwesome5 } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/theme';

const ICON_SIZE = 19;

/**
 * PHASE 1 ONLY: stock bottom tabs so every route is reachable.
 * Phase 2 replaces this with `tabBar={FloatingTabBar}` (the floating pill from Figma) and the
 * centre FAB that morphs into the "Create" sheet — see src/navigation/README.md.
 */
export default function TabsLayout() {
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: typography.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.borderHairline,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome5 name="home" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="briefcase" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resumes"
        options={{
          title: 'Resumes',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="file-alt" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <FontAwesome5 name="user" size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
