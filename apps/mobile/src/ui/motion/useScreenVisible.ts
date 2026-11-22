import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Whether the screen this component sits in is the one being looked at: its route is focused and
 * the app is in the foreground.
 *
 * Hidden tabs stay mounted (TabWarmup, §138.6) and so does every screen under a push, so an
 * ambient loop (a spinner, a run's floating art, the skeleton shimmer) kept turning on the UI
 * thread on screens nobody could see. On a low-end phone that is frame time taken from the screen
 * that is showing. Loops ask this and rest while it is false.
 *
 * Read from the navigation context directly, not through `useIsFocused`, so a component outside
 * any navigator (a root host, a test render) counts as visible instead of throwing.
 */
export function useScreenVisible(): boolean {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');

  useEffect(() => {
    // The first value came from `isFocused()` in the state initialiser; events carry it on.
    if (!navigation) return undefined;
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  return focused && foreground;
}
