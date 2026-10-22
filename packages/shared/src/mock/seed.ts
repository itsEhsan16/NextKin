/**
 * Deterministic pseudo-random helpers so fixtures and simulated latency are
 * stable across runs (and in tests). mulberry32 — small, fast, good enough.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;

/** Session-unique id with a readable prefix, e.g. "job_k3x9_12". */
export function newId(prefix: string): string {
  counter += 1;
  const stamp = Date.now().toString(36).slice(-4);
  return `${prefix}_${stamp}_${counter}`;
}

/** Integer in [min, max] from a seeded generator. */
export function intBetween(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
