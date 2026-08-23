import { MOCK_LATENCY, MockError, simulate, useMockModeStore } from '@/data/mock';

/** Runs a simulate() call to completion under fake timers and returns its settled state. */
async function settle<T>(promise: Promise<T>, advanceMs: number) {
  const outcome = promise.then(
    (value) => ({ value, error: undefined as unknown }),
    (error: unknown) => ({ value: undefined as T | undefined, error }),
  );
  await jest.advanceTimersByTimeAsync(advanceMs);
  return outcome;
}

describe('simulate()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('normal: resolves the produced value within 300–900ms', async () => {
    const produce = jest.fn(() => 'ok');
    const promise = simulate(produce);

    await jest.advanceTimersByTimeAsync(MOCK_LATENCY.normal.minMs - 1);
    expect(produce).not.toHaveBeenCalled();

    const { value, error } = await settle(promise, MOCK_LATENCY.normal.maxMs);
    expect(error).toBeUndefined();
    expect(value).toBe('ok');
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('normal: honours minMs/maxMs overrides', async () => {
    const promise = simulate(() => 1, { minMs: 10, maxMs: 10 });
    const { value } = await settle(promise, 10);
    expect(value).toBe(1);
  });

  it('slow: waits 2.5s before resolving', async () => {
    useMockModeStore.setState({ mode: 'slow' });
    const produce = jest.fn(() => [1, 2, 3]);
    const promise = simulate(produce);

    await jest.advanceTimersByTimeAsync(MOCK_LATENCY.slowMs - 1);
    expect(produce).not.toHaveBeenCalled();

    const { value } = await settle(promise, 1);
    expect(value).toEqual([1, 2, 3]);
  });

  it('empty: returns opts.empty() instead of the produced value', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const produce = jest.fn(() => [1, 2, 3]);
    const { value } = await settle(simulate(produce, { empty: () => [] }), MOCK_LATENCY.emptyMs);
    expect(value).toEqual([]);
    expect(produce).not.toHaveBeenCalled();
  });

  it('empty: falls back to produce() when no empty factory is given', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const { value } = await settle(
      simulate(() => 'single'),
      MOCK_LATENCY.emptyMs,
    );
    expect(value).toBe('single');
  });

  it('error: rejects with a MockError after 600ms', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const produce = jest.fn(() => 'never');
    const { value, error } = await settle(simulate(produce), MOCK_LATENCY.errorMs);

    expect(value).toBeUndefined();
    expect(error).toBeInstanceOf(MockError);
    expect((error as MockError).code).toBe('MOCK_ERROR');
    expect((error as MockError).message).toBe('Simulated failure');
    expect(produce).not.toHaveBeenCalled();
  });
});
