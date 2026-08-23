import { useReducedMotion } from 'react-native-reanimated';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export { useReducedMotion };

/**
 * Returns a config that collapses to an instant transition when the OS
 * "Reduce Motion" setting is on. Use for decorative motion (entrances, overshoot).
 * Functional motion (a sheet revealing content) may keep a short timing instead.
 */
export function withReducedMotion<T extends WithSpringConfig | WithTimingConfig>(
  reduced: boolean,
  config: T,
): T {
  if (!reduced) return config;
  return { ...config, duration: 1 } as T;
}
