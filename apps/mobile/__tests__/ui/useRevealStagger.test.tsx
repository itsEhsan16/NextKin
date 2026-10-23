import { act, cleanup, renderHook } from '@testing-library/react-native';

import { useRevealStagger } from '@/ui/motion';

// The shared mock hands out a fresh shared value on every render; pin one per hook instance, as
// the real hook does, so the "revealed" flag survives into the next render.
jest.mock('react-native-reanimated', () => {
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

describe('useRevealStagger', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('does not animate content that is already there when the screen opens', async () => {
    const { result } = await renderHook(() => useRevealStagger(true));

    expect(result.current?.(0)).toBeUndefined();
  });

  it('staggers the content that replaces a skeleton, in that commit only', async () => {
    let ready = false;
    const seen: boolean[] = [];
    const { rerender } = await renderHook(() => {
      const enter = useRevealStagger(ready);
      seen.push(enter(0) !== undefined);
      return enter;
    });

    // The render in which the data lands hands out the entrance…
    ready = true;
    await act(async () => {
      await rerender({});
    });
    expect(seen[seen.length - 1]).toBe(true);

    // …and once that commit is done, items mounting later (a filter change) just appear.
    await act(async () => {
      await rerender({});
    });
    expect(seen[seen.length - 1]).toBe(false);
  });
});
