import { useEffect, useState } from 'react';

/**
 * Trailing-edge debounce for values that feed a query key.
 *
 * Typing into a server-backed search would otherwise mint a new key per keystroke, dropping the
 * list into its loading state on every character. The input itself stays fully controlled — only
 * the value that reaches the query is delayed.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [debounced, delayMs, value]);

  return debounced;
}
