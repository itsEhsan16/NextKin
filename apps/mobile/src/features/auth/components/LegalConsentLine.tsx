import { useRouter } from 'expo-router';
import type { StyleProp, TextStyle } from 'react-native';

import { Text } from '@/ui/Text';

/**
 * "By continuing you agree to the Terms and the Privacy Policy", with both documents one tap
 * away before an account exists. Google Play asks that the privacy policy is reachable from the
 * app, and a reader agreeing to terms should be able to read them first. The legal route sits
 * outside the signed-in guard for this (app/_layout.tsx).
 */
export function LegalConsentLine({ style }: { style?: StyleProp<TextStyle> }) {
  const router = useRouter();
  return (
    <Text variant="footnote" color="textSecondary" align="center" style={style}>
      {'By continuing you agree to the '}
      <Text
        variant="footnote"
        color="brand"
        accessibilityRole="link"
        onPress={() => router.push('/legal/terms')}
      >
        Terms
      </Text>
      {' and the '}
      <Text
        variant="footnote"
        color="brand"
        accessibilityRole="link"
        onPress={() => router.push('/legal/privacy')}
      >
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
