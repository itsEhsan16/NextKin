import { cleanup, renderHook } from '@testing-library/react-native';

import { GENERATION_TICK_MS } from '@/data/repos';
import { durations } from '@/theme';
import { resetMeterMemory, useMeterValue, type MeterOptions } from '@/ui/Progress/meterMemory';

/**
 * Where the meter STARTS when it mounts — read during the first render, before the effect sets it
 * off toward its target (the mock lands that animation at once).
 */
async function startOf(target: number, options: MeterOptions) {
  let start: number | undefined;
  const hook = await renderHook(() => {
    const value = useMeterValue(target, options);
    start ??= value.get();
    return value;
  });
  return { start, hook };
}

describe('useMeterValue', () => {
  afterEach(async () => {
    await cleanup();
    resetMeterMemory();
  });

  it('counts up from 0 the first time a meter appears', async () => {
    const { start } = await startOf(72, { memoryKey: 'ats:r1' });

    expect(start).toBe(0);
  });

  it('starts a remounted meter from what it last showed, so it does not sweep again', async () => {
    const first = await startOf(72, { memoryKey: 'ats:r1' });
    await first.hook.unmount();

    // A search keystroke or a grid/list switch remounts the card and its ring.
    const again = await startOf(72, { memoryKey: 'ats:r1' });

    expect(again.start).toBe(72);
  });

  it('keeps meters apart by key', async () => {
    const first = await startOf(72, { memoryKey: 'ats:r1' });
    await first.hook.unmount();

    const other = await startOf(40, { memoryKey: 'ats:r2' });

    expect(other.start).toBe(0);
  });

  it('starts at the value itself when not animated', async () => {
    const { start } = await startOf(0.4, { animated: false });

    expect(start).toBe(0.4);
  });
});

describe('live progress timing', () => {
  it('glides for exactly one generation tick, so ticks join into one continuous motion', () => {
    // If the feed's beat changes, `durations.follow` must change with it, or the bar goes back
    // to moving and pausing in steps.
    expect(durations.follow).toBe(GENERATION_TICK_MS);
  });
});
