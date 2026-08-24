import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/ui/Text';

import { FIGMA_REFS, overlayGeometryFor } from './figmaRefs';
import { OPACITY_STEPS, useOverlayStore } from './overlayStore';

/**
 * Dev-only Figma overlay. Lays the artboard render over the live screen at the same logical
 * width, so the two can be compared directly rather than by eye across two devices.
 *
 * It floats over whatever route is showing rather than being one itself: you navigate to the
 * screen you want, then flip it on. Nothing here reaches production — the whole module is
 * mounted behind `__DEV__` in AppProviders.
 *
 * The overlay is `pointerEvents: 'none'`, so the app underneath stays usable; only the control
 * bar takes touches.
 */
export function FigmaOverlay() {
  const visible = useOverlayStore((state) => state.visible);
  const nodeId = useOverlayStore((state) => state.nodeId);
  const opacity = useOverlayStore((state) => state.opacity);
  const offsetY = useOverlayStore((state) => state.offsetY);
  const setNodeId = useOverlayStore((state) => state.setNodeId);
  const setOpacity = useOverlayStore((state) => state.setOpacity);
  const nudge = useOverlayStore((state) => state.nudge);
  const hide = useOverlayStore((state) => state.hide);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!__DEV__ || !visible) return null;

  const ref = FIGMA_REFS.find((candidate) => candidate.id === nodeId) ?? FIGMA_REFS[0];
  if (!ref) return null;

  const geometry = overlayGeometryFor(ref, width);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={ref.source}
          style={{
            position: 'absolute',
            left: geometry.left,
            top: geometry.top + offsetY,
            width: geometry.width,
            height: geometry.height,
            opacity,
          }}
          contentFit="fill"
        />
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
          {FIGMA_REFS.map((candidate) => (
            <Pressable
              key={candidate.id}
              onPress={() => setNodeId(candidate.id)}
              style={[styles.chip, candidate.id === ref.id && styles.chipOn]}
            >
              <Text variant="micro" color={candidate.id === ref.id ? 'textOnDark' : 'textPrimary'}>
                {candidate.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.controls}>
          {OPACITY_STEPS.map((step) => (
            <Pressable
              key={step}
              onPress={() => setOpacity(step)}
              style={[styles.chip, step === opacity && styles.chipOn]}
            >
              <Text variant="micro" color={step === opacity ? 'textOnDark' : 'textPrimary'}>
                {`${Math.round(step * 100)}%`}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => nudge(-1)} style={styles.chip}>
            <Text variant="micro">↑</Text>
          </Pressable>
          <Pressable onPress={() => nudge(1)} style={styles.chip}>
            <Text variant="micro">↓</Text>
          </Pressable>
          <Pressable onPress={hide} style={[styles.chip, styles.chipOn]}>
            <Text variant="micro" color="textOnDark">
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Deliberately literal: this is scaffolding for reading the app, not part of it, and it must
// not move when the thing it is measuring does.
const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 6,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.2)',
  },
  picker: { maxHeight: 34 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  chipOn: { backgroundColor: '#111827' },
});
