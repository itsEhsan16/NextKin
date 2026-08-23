import 'react-native-gesture-handler/jestSetup';

// Reanimated 4 ships its own jest mock.
jest.mock('react-native-reanimated', () => {
  // jest.mock factories are hoisted above imports, so the mock needs require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    // Not covered by the official mock; the app treats reduced motion as a plain boolean.
    useReducedMotion: () => false,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
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

