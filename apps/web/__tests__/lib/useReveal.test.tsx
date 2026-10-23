import { renderHook } from '@testing-library/react';

import { useReveal } from '@/lib/useReveal';

describe('useReveal', () => {
  it('fades in content that replaces a skeleton', () => {
    const { result, rerender } = renderHook(({ ready }) => useReveal(ready), {
      initialProps: { ready: false },
    });
    expect(result.current).toBe(false);

    rerender({ ready: true });
    expect(result.current).toBe(true);
  });

  it('shows content that was ready on arrival at once', () => {
    const { result, rerender } = renderHook(({ ready }) => useReveal(ready), {
      initialProps: { ready: true },
    });
    expect(result.current).toBe(false);

    rerender({ ready: true });
    expect(result.current).toBe(false);
  });

  it('fades in every item picked after the one it arrived with, that one included', () => {
    const { result, rerender } = renderHook(({ id }) => useReveal(true, id), {
      initialProps: { id: 'job_google' },
    });
    expect(result.current).toBe(false);

    rerender({ id: 'job_adobe' });
    expect(result.current).toBe(true);

    rerender({ id: 'job_google' });
    expect(result.current).toBe(true);
  });

  it('never fades while nothing is ready', () => {
    const { result } = renderHook(() => useReveal(false, 'job_google'));
    expect(result.current).toBe(false);
  });
});
