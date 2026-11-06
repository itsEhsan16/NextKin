import { Platform } from 'react-native';
import { useReducedMotion as useOsReducedMotion } from 'react-native-reanimated';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/**
 * The OS "Reduce Motion" setting. On web — only the dev preview of this phone app (toreview §173),
 * never a shipped target — it is always on: Reanimated's entering animations do not run there, so
 * anything that fades in would stay invisible.
 */
export function useReducedMotion(): boolean {
  const reduced = useOsReducedMotion();
  return Platform.OS === 'web' || reduced;
}

/**
 * Returns a config that collapses to an instant transition when the OS
 * "Reduce Motion" setting is on. Use for decorative motion (entrances, overshoot).
 * Functional motion (a sheet revealing content) may keep a short timing instead.
 *
 * A worklet, for the same reason `rangeMath` and `swipeMath` are: it is a motion helper, so a
 * worklet will sooner or later call it, and a plain function reached from the UI runtime is not a
 * slow path but a hard crash. The plugin rewrites the captured function as a *remote* function,
 * and Worklets refuses to run one synchronously — "Tried to synchronously call a Remote
 * Function". Callers on the JS thread are unaffected: a workletised function is an ordinary
 * function there.
 */
export function withReducedMotion<T extends WithSpringConfig | WithTimingConfig>(
  reduced: boolean,
  config: T,
): T {
  'worklet';
  if (!reduced) return config;
  return { ...config, duration: 1 } as T;
}
