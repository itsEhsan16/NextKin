import { act, cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { TabSceneFade } from '@/navigation';

// The shared mock hands out a fresh shared value on every render, so a value set from an event
// would be lost on the next render. Pin one per component instance, as the real hook does.
jest.mock('react-native-reanimated', () => {
  // jest.mock factories are hoisted above imports, so the mock needs require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRef } = require('react');
  return {
    ...mock,
    useReducedMotion: () => false,
    useSharedValue: (init: unknown) => {
      const ref = useRef(null);
      if (ref.current === null) ref.current = mock.useSharedValue(init);
      return ref.current;
    },
  };
});

type Listener = () => void;

/** A tab route's navigation object: two tabs, `a` and `b`, with this scene on `a`. */
function fakeNavigation(focusedKey: string) {
  const listeners = { focus: new Set<Listener>(), blur: new Set<Listener>() };
  const state = { index: focusedKey === 'a' ? 0 : 1, routes: [{ key: 'a' }, { key: 'b' }] };
  return {
    state,
    addListener: (type: 'focus' | 'blur', callback: Listener) => {
      listeners[type].add(callback);
      return () => listeners[type].delete(callback);
    },
    getState: () => state,
    isFocused: () => state.routes[state.index]?.key === 'a',
    emit: (type: 'focus' | 'blur') => listeners[type].forEach((callback) => callback()),
  };
}

const opacity = () => StyleSheet.flatten(screen.getByTestId('tab-scene').props.style).opacity;

async function renderScene(navigation: ReturnType<typeof fakeNavigation>) {
  // A fresh element each time: re-rendering the identical element would let React bail out.
  const tree = () => (
    <TabSceneFade navigation={navigation} routeKey="a">
      <View />
    </TabSceneFade>
  );
  await render(tree());
  // Animated styles are read at render under the mock; render again to read the settled value.
  return () => screen.rerender(tree());
}

describe('TabSceneFade', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('fades in a scene that mounts focused, so the launch tab is never left transparent', async () => {
    const reread = await renderScene(fakeNavigation('a'));
    await reread();

    expect(opacity()).toBe(1);
  });

  it('keeps a preloaded, unfocused scene transparent until the user switches to it', async () => {
    const navigation = fakeNavigation('b');
    const reread = await renderScene(navigation);
    await reread();
    expect(opacity()).toBe(0);

    navigation.state.index = 0;
    await act(async () => navigation.emit('focus'));
    await reread();
    expect(opacity()).toBe(1);
  });

  it('hides the scene when the user switches to another tab, then fades it back in', async () => {
    const navigation = fakeNavigation('a');
    const reread = await renderScene(navigation);

    navigation.state.index = 1;
    await act(async () => navigation.emit('blur'));
    await reread();
    expect(opacity()).toBe(0);

    navigation.state.index = 0;
    await act(async () => navigation.emit('focus'));
    await reread();
    expect(opacity()).toBe(1);
  });

  it('stays visible when a stack screen is pushed over the tab, so the pop never shows a blank', async () => {
    const navigation = fakeNavigation('a');
    const reread = await renderScene(navigation);

    // The tab navigator still points at this tab: the blur came from the parent stack.
    await act(async () => navigation.emit('blur'));
    await reread();

    expect(opacity()).toBe(1);
  });
});
