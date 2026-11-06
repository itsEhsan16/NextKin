import { useCallback, useMemo, useRef, type RefObject } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTabBarLayout, useTheme } from '@/theme';
import { EDGE_FADE_DEPTH, EdgeFade } from '@/ui/EdgeFade';
import { GradientWash } from '@/ui/GradientWash';
import { SheetLayerHost } from '@/ui/Sheet/SheetLayer';

import { keyboardBottomReserve } from './keyboardReserve';
import { KeyboardFrame } from './KeyboardFrame';
import { isKeyboardSettled, RevealProvider } from './revealOnFocus';
import type { ScreenProps } from './screenProps';
import { isAtEnd } from './scrollMath';

const DEFAULT_EDGES: readonly Edge[] = ['top'];
/** How far the `wash` reaches below the safe area, at 390. */
const WASH_HEIGHT = 300;

/**
 * Safe-area aware page container. Every route renders exactly one `Screen` at its root so
 * backgrounds, gutters and tab-bar insets stay consistent across the app.
 */
export function Screen({
  edges = DEFAULT_EDGES,
  scroll = false,
  padded = true,
  wash = false,
  keyboard = false,
  tabBarInset = false,
  header,
  headerStyle,
  headerFade = false,
  footer,
  footerStyle,
  contentContainerStyle,
  refreshControl,
  scrollRef,
  followEnd = false,
  children,
}: ScreenProps) {
  const { colors, spacing, sizes, s } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarLayout();

  // The three things `RevealProvider` needs to lift a focused field clear of the keyboard. Refs
  // rather than state on purpose: a scroll offset in state would re-render the page on every
  // frame of every scroll, and nothing here paints from these values.
  const ownScrollRef = useRef<ScrollViewInstance>(null);
  const activeScrollRef = scrollRef ?? ownScrollRef;
  // On the UI thread, so the header fade follows the scroll without a render per frame; the reveal
  // reads it synchronously when a field takes focus.
  const scrollOffset = useSharedValue(0);
  const atEnd = useSharedValue(true);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollOffset.set(event.contentOffset.y);
    atEnd.set(isAtEnd(event));
  });
  // Unanimated on purpose: growth arrives in small steps, and overlapping animated scrolls judder.
  const followContent = useCallback(() => {
    if (atEnd.get()) activeScrollRef.current?.scrollToEnd({ animated: false });
  }, [activeScrollRef, atEnd]);
  const getOffset = useCallback(() => scrollOffset.get(), [scrollOffset]);
  const footerHeight = useRef(0);
  /** Where the scroll viewport starts in the window — under the safe area and the header. */
  const viewportTop = useRef(0);
  /** The reveal, re-run when the viewport resizes — see the scroller's `onLayout`. */
  const revealAgain = useRef<(() => void) | null>(null);

  // Only ever non-zero in scroll mode — the types see to that, but state it here too: this
  // lands on the ScrollView's content container, where it lets content pass under the pill.
  const tabBarSpace = scroll && tabBarInset ? tabBar.contentInset : 0;

  // A ReactNode is a new value on every render; only its presence moves the padding below.
  const hasFooter = footer != null;

  const safeAreaStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: colors.surfacePage,
      paddingTop: edges.includes('top') ? insets.top : 0,
      paddingLeft: edges.includes('left') ? insets.left : 0,
      paddingRight: edges.includes('right') ? insets.right : 0,
      // Two things can claim the bottom inset and neither may share it. When the tab bar
      // reserves space it already accounts for the inset; a footer likewise pads
      // `spacing[4] + insets.bottom` itself, so its background runs to the bottom of the glass
      // instead of stopping on a strip of page. The same hand-off in both cases.
      paddingBottom: !tabBarInset && !hasFooter && edges.includes('bottom') ? insets.bottom : 0,
    }),
    [colors.surfacePage, edges, hasFooter, insets, tabBarInset],
  );

  // Everything the pinned header and the scroll content must agree on, so the two columns of
  // rows line up. Note what is absent: `paddingBottom`, which is the tab-bar reservation and
  // belongs only to the thing that scrolls.
  const frameStyle = useMemo<ViewStyle>(
    () => ({
      paddingHorizontal: padded ? spacing.gutter : 0,
      // Past the artboard width the design stops growing and centres, rather than stretching
      // a 520px layout across a tablet.
      width: '100%',
      maxWidth: sizes.designWidth,
      alignSelf: 'center',
    }),
    [padded, sizes.designWidth, spacing.gutter],
  );

  const contentStyle = useMemo<ViewStyle>(
    () => ({ ...frameStyle, paddingBottom: tabBarSpace }),
    [frameStyle, tabBarSpace],
  );

  // Built once so both roots below take the same array. On the static branch the root already
  // spreads `contentStyle`, which is why its header box takes `headerStyle` alone — re-applying
  // the gutter there would double it.
  const rootStyle: StyleProp<ViewStyle> = scroll
    ? [styles.root, safeAreaStyle]
    : [styles.root, safeAreaStyle, contentStyle, contentContainerStyle];

  const content = scroll ? (
    <>
      {/*
        Never `styles.root` here: a `flex: 1` header would take half the viewport and starve
        the scroller. The box is intrinsic height, and RN's default `flexShrink: 0` means the
        scroller cannot squeeze it either.
      */}
      {header != null ? <View style={[frameStyle, headerStyle]}>{header}</View> : null}
      {/* The box the content scrolls in, so the edge fades can sit inside it, over the content. */}
      <View
        style={styles.root}
        onLayout={(event: LayoutChangeEvent) => {
          viewportTop.current = event.nativeEvent.layout.y;
          // The box shrinks with the keyboard, and a reveal that ran before it settled had its
          // scroll clamped by the taller box: the field stayed under the bar. Re-run it once the
          // keyboard is fully up — not on each frame of its travel, which would chase the padding.
          if (isKeyboardSettled()) revealAgain.current?.();
        }}
      >
        <Animated.ScrollView
          ref={activeScrollRef as RefObject<Animated.ScrollView | null>}
          style={styles.root}
          contentContainerStyle={[contentStyle, contentContainerStyle]}
          contentInsetAdjustmentBehavior="never"
          // Tracked so `RevealProvider` can turn a window-space delta into a scroll target, and so
          // the header fade knows when something has slid under it.
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Also what dismisses the keyboard on a tap outside a field: the tap reaches the control
          // under it instead of being spent closing the keyboard.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          onContentSizeChange={followEnd ? followContent : undefined}
        >
          {children}
        </Animated.ScrollView>
        {header != null ? <EdgeFade edge="top" progress={scrollOffset} /> : null}
        {footer != null ? <EdgeFade edge="bottom" /> : null}
      </View>
      {/*
        No `frameStyle` here, unlike the header: the bar spans edge to edge — its hairline and
        upward shadow read as the bottom of the window — and pads its own gutter inside that.
      */}
      {footer != null ? (
        <View
          style={footerStyle}
          // The bar rides above the keyboard, so it hides a field just as the keyboard does; the
          // reveal has to clear both — and the fade standing on the bar, which veils what is under
          // it just as surely.
          onLayout={(event: LayoutChangeEvent) => {
            footerHeight.current = event.nativeEvent.layout.height + s(EDGE_FADE_DEPTH);
          }}
        >
          {footer}
        </View>
      ) : null}
    </>
  ) : (
    <>
      {header != null ? <View style={headerStyle}>{header}</View> : null}
      {headerFade ? (
        <View style={styles.root}>
          {children}
          <EdgeFade edge="top" />
        </View>
      ) : (
        children
      )}
    </>
  );

  // Whatever is on the page when it first mounts arrives with the push (or the tab fade), so its
  // entrance animations are skipped; content that mounts later — loaded data replacing a skeleton,
  // a sheet's rows, a toast — still animates in (owner, 2026-10-05).
  const page = (
    <LayoutAnimationConfig skipEntering>
      {wash ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GradientWash height={s(WASH_HEIGHT) + insets.top} />
        </View>
      ) : null}
      {content}
    </LayoutAnimationConfig>
  );

  // Every sheet on the page is drawn over the window from here, outside the scroller (§174).
  if (!keyboard)
    return (
      <SheetLayerHost>
        <View style={rootStyle}>{page}</View>
      </SheetLayerHost>
    );

  return (
    <SheetLayerHost>
      <RevealProvider
        scrollRef={activeScrollRef}
        getOffset={getOffset}
        footerRef={footerHeight}
        viewportTopRef={viewportTop}
        revealAgainRef={revealAgain}
        // Only a scrolling page can reveal anything. On a static one the provider hands fields a
        // `null` and they leave the keyboard alone.
        enabled={scroll}
      >
        <KeyboardFrame
          reserve={keyboardBottomReserve({
            hasFooter,
            edges,
            tabBarInset,
            insetBottom: insets.bottom,
          })}
        >
          <View style={rootStyle}>{page}</View>
        </KeyboardFrame>
      </RevealProvider>
    </SheetLayerHost>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
