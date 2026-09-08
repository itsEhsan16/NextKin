import { View } from 'react-native';

import { board } from '../board';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { BrandMark } from '@/ui/BrandMark';
import { Text } from '@/ui/Text';

/** Figma 296:3081 — the mark at y=97 with the wordmark 6.3 under it, centred. */
const LOCKUP = { top: 97, mark: 54.78, gap: 6.29 };

/** The centred mark-and-wordmark both auth screens open with (Figma 296:3081 / 296:3198). */
export function AuthLockup() {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View accessible {...a11yHeader('NextKin')} style={[styles.centred, { paddingTop: s(board(LOCKUP.top)) }]}>
      <BrandMark height={LOCKUP.mark} />
      <Text variant="authWordmark" color="onboardingInk" style={{ marginTop: s(board(LOCKUP.gap)) }}>
        NextKin
      </Text>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
}));
