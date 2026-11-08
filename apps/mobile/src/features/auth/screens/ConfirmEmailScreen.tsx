import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { useConfirmSignUp, useResendSignUpCode } from '@/data/queries';
import { a11yHeader } from '@/lib/a11y';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { CODE_LENGTH, codeComplete, confirmErrorMessage } from '../authForms';
import { useOnboardingStore } from '../onboardingStore';
import { usePendingSignUp } from '../pendingSignUp';
import { useFirstRunStore } from '../firstRunStore';
import { useSessionStore } from '../sessionStore';

const RESENT = 'We sent a new code.';

/**
 * Confirm the emailed code (V2 §7.1; ImBackendImplementationPlan P5-08). Spec-derived: no
 * artboard exists, so it is built only from existing primitives and tokens, and is replaced
 * wholesale when one arrives (CLAUDE.md rule 7; toreview §105.12). Reached only when the app runs on
 * the backend: on the mock, sign-up signs straight in, as it always did.
 *
 * Nothing is fetched until the reader acts, so the house states are the form's own: untouched,
 * checking (the button's spinner), refused (the message under it) and accepted (signed in). With no
 * sign-up waiting — the app was closed in between — it says so and offers sign-in instead.
 */
export function ConfirmEmailScreen() {
  const router = useRouter();
  const { spacing, sizes } = useTheme();
  const { email, password, clear } = usePendingSignUp();
  const signIn = useSessionStore((state) => state.signIn);
  const markFirstRun = useFirstRunStore((state) => state.mark);
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const confirm = useConfirmSignUp();
  const resend = useResendSignUpCode();

  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'textSecondary' } | null>(
    null,
  );

  const say = (text: string, tone: 'danger' | 'textSecondary') => {
    setMessage({ text, tone });
    AccessibilityInfo.announceForAccessibility(text);
  };

  const submit = () => {
    if (confirm.isPending || !codeComplete(code)) return;
    confirm.mutate(
      { email, password, code },
      {
        onSuccess: ({ newAccount }) => {
          clear();
          markSeen();
          // A code can also finish a sign-in on a new device (Clerk, §173): no first run then.
          if (newAccount) markFirstRun();
          // Flipping the session unmounts this group and lands on the tabs, as sign-in does.
          signIn();
        },
        onError: (error) => say(confirmErrorMessage(error), 'danger'),
      },
    );
  };

  if (!email) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Confirm your email" onBack={() => router.back()} />
        <View style={{ gap: spacing[4], paddingTop: spacing[6] }}>
          <Text {...a11yHeader()} variant="headlineLg">
            Sign in to continue
          </Text>
          <Text variant="body" color="textSecondary">
            If you already entered your code, your account is ready. Sign in with your email and
            password.
          </Text>
          <Button label="Go to sign in" block onPress={() => router.replace('/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboard scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Confirm your email" onBack={() => router.back()} />
      <View style={{ gap: spacing[4], paddingTop: spacing[6] }}>
        <Text {...a11yHeader()} variant="headlineLg">
          Check your email
        </Text>
        <Text variant="body" color="textSecondary">
          {`We sent a ${CODE_LENGTH}-digit code to ${email}. Enter it to continue.`}
        </Text>
        <TextField
          label="Verification code"
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH));
            if (message?.tone === 'danger') setMessage(null);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          returnKeyType="done"
          onSubmit={submit}
        />
        <Button
          label="Confirm"
          block
          loading={confirm.isPending}
          disabled={!codeComplete(code)}
          onPress={submit}
        />
        {message ? (
          <Text variant="caption" color={message.tone} accessibilityLiveRegion="polite">
            {message.text}
          </Text>
        ) : null}
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Send a new code"
          disabled={resend.isPending}
          onPress={() => resend.mutate(email, { onSuccess: () => say(RESENT, 'textSecondary') })}
          style={{
            alignSelf: 'flex-start',
            minHeight: sizes.minHitTarget,
            justifyContent: 'center',
          }}
        >
          <Text variant="label" color="brand">
            Send a new code
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
