import { View } from 'react-native';

import { board } from '../board';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { BrandMark } from '@/ui/BrandMark';
import { Text } from '@/ui/Text';

/** Figma 309:239 — the mark at y=97 with the wordmark 6.28 under it, centred. */
const LOCKUP = { top: 97, mark: 54.78323, gap: 6.28442 };

/**
 * The centred mark-and-wordmark all three account screens open with (307:4338 / 307:4386 /
 * 309:175).
 *
 * `BrandMark` takes an *artboard* height and scales it itself — from the 520 board, like every
 * other primitive. These screens are drawn on the 422.66 one, so the drawn 54.78 has to go
 * through `board()` first, exactly as every other length here does. Without it the mark came out
 * 19% short against a wordmark that was being converted properly, which read as a mark a size too
 * small rather than as a conversion that had been skipped.
 */
export function AuthLockup() {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View
      accessible
      {...a11yHeader('NextKin')}
      style={[styles.centred, { paddingTop: s(board(LOCKUP.top)) }]}
    >
      <BrandMark height={board(LOCKUP.mark)} />
      <Text
        variant="wordmark"
        color="onboardingInk"
        style={{ marginTop: s(board(LOCKUP.gap)) }}
      >
        NextKin
      </Text>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
}));
