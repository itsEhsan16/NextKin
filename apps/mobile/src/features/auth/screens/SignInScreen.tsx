import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Button, type ButtonVariant } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

import { useSessionStore } from '../sessionStore';

type SignInOption = { label: string; variant: ButtonVariant; icon?: string };

/**
 * The three providers V2 §7.1 names. None of them talks to anything: they are here so the
 * signed-out half of the route gate has a screen, and so the shape of the real one is already
 * decided when its artboard arrives.
 */
const OPTIONS: readonly SignInOption[] = [
  { label: 'Continue with Google', variant: 'primary' },
  { label: 'Continue with Apple', variant: 'secondary' },
  { label: 'Continue with email', variant: 'ghost', icon: 'envelope' },
];

/**
 * Design-gated stand-in for the sign-in screen (V2 §7.1, plan §Phase 9A).
 *
 * Built from existing primitives only — no new visual language — because Figma has not drawn
 * this screen; it is replaced wholesale when the artboard lands. Its one real job is to give
 * `signOut()` and `deleteAccount()` somewhere to land, so those two actions in Profile stop
 * being dead ends. The copy says outright that no account is involved: a stub that implied real
 * authentication would be a lie the user could act on.
 */
export function SignInScreen() {
  const { spacing } = useTheme();
  const signIn = useSessionStore((state) => state.signIn);

  return (
    <Screen
      edges={['top', 'bottom']}
      contentContainerStyle={{ justifyContent: 'center', gap: spacing[6] }}
    >
      <View accessible {...a11yHeader('NextKin')}>
        <Text variant="wordmark">NextKin</Text>
      </View>

      <View style={{ gap: spacing[2] }}>
        <Text variant="headlineLg">Sign in to pick up where you left off</Text>
        <Text variant="body" color="textSecondary">
          Your resumes, saved jobs and application history live in your NextKin account.
        </Text>
      </View>

      <View style={{ gap: spacing[3] }}>
        {OPTIONS.map(({ label, variant, icon }) => (
          <Button
            key={label}
            label={label}
            variant={variant}
            icon={icon}
            size="lg"
            haptic="medium"
            onPress={signIn}
            block
          />
        ))}
      </View>

      <Text variant="caption" color="textTertiary" align="center">
        Sign-in is design-gated (V2 §7.1) until its screens are drawn. Any option here signs you
        into the pre-seeded mock account — no real account is created and nothing leaves this
        device.
      </Text>
    </Screen>
  );
}
