import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { haptics } from '@/lib';
import { NAV_BOOST, scaledSheet, useTabBarLayout, useTheme } from '@/theme';

import { TabBarIndicator } from './TabBarIndicator';
import { TabBarItem } from './TabBarItem';
import { TabBarShape } from './TabBarShape';
import { activeTabFor, ICON_BOOST, TABS } from './tabBarTabs';
import { scrollTabToTop, type TabName } from './tabScroll';

/**
 * Floating pill tab bar from the Home artboard.
 *
 * Rendered as a sibling of the tab navigator rather than through the navigator's `tabBar` prop,
 * so the tabs layout can order it against the hosted sheets. That puts it outside the navigator,
 * so it drives itself: active tab from `useSegments()`, navigation through the typed hrefs. The
 * FAB is a later sibling, so the centre slot here stays empty. While a sheet is open, the tabs
 * layout's `ChromeLayer` takes the pill out of reach and out of the accessibility tree.
 *
 * The bar positions itself absolutely and reserves no layout space — `Screen`'s `tabBarInset`
 * remains the single source of bottom padding for scrolling content.
 */
export function FloatingTabBar() {
  const { colors, s, u } = useTheme();
  const styles = useStyles();
  const layout = useTabBarLayout();
  const router = useRouter();
  const segments = useSegments();

  const routeActive = activeTabFor(segments);
  // The tab the user just pressed, shown as selected before the route catches up. Waiting on the
  // segments made the highlight trail the tap by the whole screen mount. Cleared as soon as the
  // route moves — to the pressed tab, or anywhere else.
  const [pressed, setPressed] = useState<TabName | null>(null);
  const [seenRoute, setSeenRoute] = useState(routeActive);
  if (seenRoute !== routeActive) {
    // Adjusted during render rather than in an effect, so no frame paints the stale press.
    setSeenRoute(routeActive);
    setPressed(null);
  }
  const active = pressed ?? routeActive;

  // Both the active tab and the router identity change across navigations. Read them through a
  // ref so the press handler keeps a stable identity and the memoised tabs stay put.
  const live = useRef({ active, router });
  useEffect(() => {
    live.current = { active, router };
  });

  const handlePress = useCallback((name: TabName) => {
    const { active: current, router: nav } = live.current;
    // Re-tapping the focused tab scrolls it to the top instead of re-navigating to itself.
    if (name === current) {
      if (scrollTabToTop(name)) haptics.selection();
      return;
    }
    const target = TABS.find((tab) => tab.name === name);
    if (!target) return;

    haptics.selection();
    setPressed(name);
    // One frame later, so the highlight commits and starts fading before the navigation's own
    // render (the tab scene, its fade, any first mount) claims the JS thread.
    requestAnimationFrame(() => nav.navigate(target.href));
  }, []);

  // Memoised so each tab's `slot` keeps its identity across renders — an inline object here
  // defeated the item memo on every navigation.
  const slots = useMemo(
    () =>
      TABS.map((tab) => ({
        left: (tab.centre - tab.slot / 2) * layout.pillWidth,
        width: tab.slot * layout.pillWidth,
      })),
    [layout.pillWidth],
  );

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: layout.bottomOffset }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { width: layout.pillWidth, height: layout.pillHeight }]}
      >
        <TabBarShape pillWidth={layout.pillWidth} color={colors.tabBarBackground} />
        {/* The light under the selected tab, gliding between them (§192). */}
        <TabBarIndicator
          centre={(TABS.find((tab) => tab.name === active)?.centre ?? 0) * layout.pillWidth}
          width={u(INDICATOR_W)}
          height={layout.pillHeight - u(INDICATOR_INSET)}
        />
        {TABS.map((tab, index) => (
          <TabBarItem
            key={tab.name}
            name={tab.name}
            label={tab.label}
            Icon={tab.Icon}
            IconActive={tab.IconActive}
            focused={tab.name === active}
            iconWidth={s(tab.w * NAV_BOOST * ICON_BOOST)}
            iconHeight={s(tab.h * NAV_BOOST * ICON_BOOST)}
            slot={slots[index] ?? EMPTY_SLOT}
            onPress={handlePress}
          />
        ))}
      </View>
    </View>
  );
}

/** Unreachable (`slots` maps `TABS` one to one); satisfies `noUncheckedIndexedAccess`. */
const EMPTY_SLOT = {};

/** The selected tab's light at 390: wide enough for the longest label, inset from the pill. */
const INDICATOR_W = 66;
const INDICATOR_INSET = 12;

const useStyles = scaledSheet(() => ({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Nothing is in flow: each tab is placed on its own board centre, and the FAB — a later
  // sibling entirely — needs no slot reserved for it.
  pill: { justifyContent: 'center' },
}));
