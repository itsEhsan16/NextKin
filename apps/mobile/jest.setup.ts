import 'react-native-gesture-handler/jestSetup';

// The library's own stand-in for its native module.
jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- hoisted factory.
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Gesture Handler 3's GestureDetector throws in dev unless a GestureHandlerRootView sits above it.
// The app has one (AppProviders); component suites render detectors on their own, so the root
// context defaults to present here, the way the library's own jestSetup mocks its internals.
jest.mock('react-native-gesture-handler/src/GestureHandlerRootViewContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- hoisted factory.
  const { createContext } = require('react');
  return { __esModule: true, default: createContext(true) };
});
jest.mock('react-native-gesture-handler/lib/module/GestureHandlerRootViewContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- hoisted factory.
  const { createContext } = require('react');
  return { __esModule: true, default: createContext(true) };
});

// jest-expo 58.0.12 mocks `react-native/asset-registry`, but React Native 0.88's `AssetRegistry`
// export, which expo-asset reads, comes from a private module. Without the same stub there, a font
// registered through the mock (icon fonts) is looked up in the real, empty registry and throws.
jest.mock('react-native/src/private/assets/AssetRegistry', () => ({
  AssetRegistry: {
    registerAsset: jest.fn(() => 1),
    getAssetByID: jest.fn(() => ({
      fileSystemLocation: '/full/path/to/directory',
      httpServerLocation: '/assets/full/path/to/directory',
      scales: [1],
      fileHashes: ['md5'],
      name: 'name',
      exists: true,
      type: 'type',
      hash: 'md5',
      uri: 'uri',
      width: 1,
      height: 1,
    })),
  },
}));

// Worklets ships its own jest mock too. Reanimated 4.7 calls `runOnUISync` when it loads, and the
// web build the worklets resolver picks for tests throws on it; the mock runs it in place.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-worklets/src/mock'),
);

// Reanimated 4 ships its own jest mock.
jest.mock('react-native-reanimated', () => {
  // jest.mock factories are hoisted above imports, so the mock needs require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    // Not covered by the official mock; the app treats reduced motion as a plain boolean.
    useReducedMotion: () => false,
    // "ADD ME IF NEEDED" in the official mock: `Screen` wraps every page in it.
    LayoutAnimationConfig: ({ children }: { children: unknown }) => children,
    // The official mock returns undefined. A colour that fades between two states rests on one of
    // them, so the nearest endpoint keeps colour assertions meaningful.
    interpolateColor: (value: number, input: number[], output: unknown[]) => {
      const first = input[0] ?? 0;
      const last = input[input.length - 1] ?? 1;
      return Math.abs(value - first) <= Math.abs(value - last)
        ? output[0]
        : output[output.length - 1];
    },
    // The official mock returns the initial value itself; the app holds module-level shared
    // values (the skeleton clock), so it needs one shaped like `useSharedValue`'s.
    makeMutable: (initial: unknown) => {
      const box = { value: initial };
      return {
        get value() {
          return box.value;
        },
        set value(next) {
          box.value = next;
        },
        get: () => box.value,
        set: (next: unknown) => {
          box.value = typeof next === 'function' ? next(box.value) : next;
        },
      };
    },
  };
});

// The keyboard controller's own mock: hooks report a closed keyboard, the avoider is a View.
jest.mock('react-native-keyboard-controller', () =>
  // jest.mock factories are hoisted above imports, so the mock needs require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-keyboard-controller/jest'),
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Permission STATE only (plan §Phase 6): default to "never asked". Suites that exercise the
// push primer re-mock these per file to observe the request.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, canAskAgain: true, status: 'undetermined' }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, canAskAgain: false, status: 'granted' }),
  ),
}));

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (k: string) => store.get(k) ?? null,
      setItemSync: (k: string, v: string) => void store.set(k, v),
      removeItemSync: (k: string) => void store.delete(k),
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    },
  };
});

// FlashList's RecyclerView measures itself in layout effects (setState during commit), which
// trips React 19's act() bookkeeping under Jest. Stand it in with FlatList — same props surface
// for everything the app uses (horizontal, renderItem, keyExtractor, separators, snapping).
jest.mock('@shopify/flash-list', () => {
  const actual = jest.requireActual('@shopify/flash-list');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- same hoisting constraint.
  const { FlatList } = require('react-native');
  return { ...actual, FlashList: FlatList, AnimatedFlashList: FlatList };
});
