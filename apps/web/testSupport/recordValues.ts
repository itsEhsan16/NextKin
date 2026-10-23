/**
 * Every value a control shows from now until `stop()`, sampled every few milliseconds. A control
 * that flips back for a moment and then forward again still ends in the right state, so a check
 * of the final state alone would miss it.
 */
export function recordValues<T>(read: () => T, everyMs = 10): { stop: () => T[] } {
  const values: T[] = [read()];
  const timer = setInterval(() => {
    const value = read();
    if (value !== values[values.length - 1]) values.push(value);
  }, everyMs);
  return {
    stop: () => {
      clearInterval(timer);
      return values;
    },
  };
}
