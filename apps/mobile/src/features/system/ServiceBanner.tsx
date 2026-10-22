import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { degradedMessages, useBackendServiceStatus } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';

/**
 * The degraded-mode banner (ImBackendImplementationPlan P13-02, R-09). Spec-derived: no artboard
 * draws it, so it is the existing note bar with its info glyph, pinned under the status bar, and
 * it is replaced wholesale when one arrives (toreview §105.20). It says what is slow or paused and
 * what still works; a tap hides it until the message changes. In mock mode it never shows.
 */
export function ServiceBanner() {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const status = useBackendServiceStatus();
  const lines = degradedMessages(status.data);
  const text = lines.join(' ');
  const [hidden, setHidden] = useState<string | null>(null);

  if (!text || hidden === text) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing[2], paddingHorizontal: spacing.gutter }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text} Tap to hide.`}
        onPress={() => setHidden(text)}
      >
        <NoteBar icon="info-circle" text={text} />
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  wrap: { position: 'absolute', left: 0, right: 0 },
}));
