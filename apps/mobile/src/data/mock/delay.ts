import { getMockMode } from './mode';
import { intBetween, seeded } from './seed';

export class MockError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MockError';
    this.code = code;
  }
}

export const MOCK_LATENCY = {
  normal: { minMs: 300, maxMs: 900 },
  slowMs: 2500,
  emptyMs: 500,
  errorMs: 600,
} as const;

export type SimulateOptions<T> = {
  /** Value returned in "empty" mode; defaults to `produce()`. */
  empty?: () => T;
  minMs?: number;
  maxMs?: number;
};

const random = seeded(0x5eed);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps a synchronous producer with mock-mode behaviour (latency, empty, error).
 * Every mock repo method goes through here so the dev mode switch works everywhere.
 */
export async function simulate<T>(produce: () => T, opts: SimulateOptions<T> = {}): Promise<T> {
  const mode = getMockMode();
  switch (mode) {
    case 'slow':
      await wait(MOCK_LATENCY.slowMs);
      return produce();
    case 'empty':
      await wait(MOCK_LATENCY.emptyMs);
      return opts.empty?.() ?? produce();
    case 'error':
      await wait(MOCK_LATENCY.errorMs);
      throw new MockError('MOCK_ERROR', 'Simulated failure');
    default: {
      const minMs = opts.minMs ?? MOCK_LATENCY.normal.minMs;
      const maxMs = Math.max(minMs, opts.maxMs ?? MOCK_LATENCY.normal.maxMs);
      await wait(intBetween(random, minMs, maxMs));
      return produce();
    }
  }
}

export const isMockError = (error: unknown): error is MockError => error instanceof MockError;
