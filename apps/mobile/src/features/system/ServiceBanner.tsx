import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { degradedMessages, useBackendServiceStatus, useIsOnline } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';

/**
 * The degraded-mode banner (ImBackendImplementationPlan P13-02, R-09). Spec-derived: no artboard
 * draws it, so it is the existing note bar with its info glyph, pinned under the status bar, and
 * it is replaced wholesale when one arrives (toreview §105.20). It says what is slow or paused and
 * what still works; a tap hides it until the message changes. In mock mode it never shows. With no
 * connection it says that instead: nothing else matters until it's back (toreview §145.5).
 */
/**
 * How long the note stays before it steps aside on its own. It floats over the top of every
 * screen, where the back button and the title are, so it must not sit there until someone finds
 * out that tapping it hides it. A new message (going offline again, a different outage) brings
 * it back, because the note is keyed on its text.
 */
export const BANNER_HOLD_MS = 6000;

export const OFFLINE_NOTE = 'You’re offline. Resumes open again once you’re back online.';

export function ServiceBanner() {
  const status = useBackendServiceStatus();
  const online = useIsOnline();
  const lines = degradedMessages(status.data);
  const text = online ? lines.join(' ') : OFFLINE_NOTE;
  // Keyed, so a note hidden once comes back the next time it applies.
  return text ? <BannerNote key={text} text={text} /> : null;
}

function BannerNote({ text }: { text: string }) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), BANNER_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (hidden) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing[2], paddingHorizontal: spacing.gutter }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text} Tap to hide.`}
        onPress={() => setHidden(true)}
      >
        <NoteBar icon="InfoCircle" text={text} />
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  wrap: { position: 'absolute', left: 0, right: 0 },
}));
