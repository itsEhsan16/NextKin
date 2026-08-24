import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { sizes } from '@/theme/tokens';

import { useArtboardStore } from './artboardStore';

export type ArtboardModeProps = { children: ReactNode };

/**
 * Dev-only fidelity oracle. Lays the entire tree out at exactly the 520px artboard width, then
 * transform-scales it down to the device. Because Yoga literally runs at 520, the result is a
 * mathematically perfect proportional replica of the Figma frame — no component changes involved.
 *
 * Use it as a differ: toggle it from `app/dev` on any screen. If nothing moves, that screen's
 * scaling is complete. Anything that jumps is a 520-space literal that never went through the
 * scaled theme or `s()`.
 *
 * It is NOT a shipping strategy, and must never be enabled outside `__DEV__`:
 *  - iOS applies `layer.transform`, so text rasterises at its natural size and is resampled
 *    (visibly soft). Android composites similarly.
 *  - Native `Modal`s and the status bar render outside the transform.
 *  - Safe-area insets and keyboard heights arrive in device space and get scaled with everything
 *    else, so chrome sits slightly off.
 */
export function ArtboardMode({ children }: ArtboardModeProps) {
  const enabled = useArtboardStore((s) => s.enabled);
  const { width, height } = useWindowDimensions();

  if (!__DEV__ || !enabled) return <>{children}</>;

  const scale = width / sizes.designWidth;

  return (
    <View style={styles.clip}>
      <View
        style={{
          width: sizes.designWidth,
          height: height / scale,
          transform: [{ scale }],
          transformOrigin: 'top left',
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
});
