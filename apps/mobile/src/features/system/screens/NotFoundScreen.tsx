import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { FlowHero, type FlowArt } from '@/features/create/components/FlowHero';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

// SYSTEM 01 at 390 (580:2883), in artboard units.
const HERO_TO_BUTTON = 24 / 0.75;

/** IL-B3 (681:156), the clay illustration (§211), fitted inside the board’s box: the folded map and the lost paper plane. */
const NOT_FOUND_ART: FlowArt = {
  source: require('../../../../assets/illustrations/system/not-found.webp'),
  w: 282,
  h: 227.2,
  shiftX: 0,
  toTitle: 3, // 681:156 → 580:2892
};

/**
 * SYSTEM 01 — Page not found (Figma 580:2883): the drawing, the title, one plain line, and the
 * way home. The block sits on the screen's centre line: the board's 1080 frame puts it near the
 * top, which on a phone-height screen is the middle anyway.
 *
 * Home is a `replace`, not a push: Back from Home must not land on the dead link again.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const styles = useStyles();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.root}>
        <FlowHero
          title="Page not found"
          lede="The link you followed does not match any screen."
          art={NOT_FOUND_ART}
        />
        <Button
          label="Go to Home"
          icon="Home02"
          size="xl"
          block
          onPress={() => router.replace('/')}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1, justifyContent: 'center' },
  button: { marginTop: s(HERO_TO_BUTTON) },
}));
