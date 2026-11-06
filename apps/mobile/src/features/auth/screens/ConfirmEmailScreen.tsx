import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useConfirmSignUp, useResendSignUpCode } from '@/data/queries';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { CODE_LENGTH, codeComplete, confirmErrorMessage } from '../authForms';
import { AuthShell } from '../components/AuthShell';
import { CodeBoxes } from '../components/CodeBoxes';
import { useFirstRunStore } from '../firstRunStore';
import { useOnboardingStore } from '../onboardingStore';
import { usePendingSignUp } from '../pendingSignUp';
import { useSessionStore } from '../sessionStore';

const RESEND_AFTER_S = 30;

/**
 * Confirm the emailed code (§172). Six boxes that submit themselves when full, and a resend link
 * that unlocks after a short wait. Reached only on the backend; the mock signs straight in.
 */
export function ConfirmEmailScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { email, password, clear } = usePendingSignUp();
  const signIn = useSessionStore((state) => state.signIn);
  const markFirstRun = useFirstRunStore((state) => state.mark);
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const confirm = useConfirmSignUp();
  const resend = useResendSignUpCode();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = (value = code) => {
    if (confirm.isPending || !codeComplete(value)) return;
    confirm.mutate(
      { email, password, code: value },
      {
        onSuccess: () => {
          clear();
          markSeen();
          markFirstRun();
          signIn();
        },
        onError: (failure) => {
          const text = confirmErrorMessage(failure);
          setError(text);
          AccessibilityInfo.announceForAccessibility(text);
        },
      },
    );
  };

  if (!email) {
    return (
      <AuthShell title="Sign in to continue" subtitle="Your account may already be ready.">
        <Button
          label="Go to sign in"
          size="xl"
          block
          onPress={() => router.replace('/sign-in')}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Check your email" subtitle={`Enter the ${CODE_LENGTH}-digit code sent to ${email}.`}>
      <CodeBoxes
        length={CODE_LENGTH}
        value={code}
        error={error != null}
        onChange={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        onComplete={submit}
      />

      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite" style={styles.note}>
          {error}
        </Text>
      ) : null}

      <Button
        label="Confirm"
        size="xl"
        block
        loading={confirm.isPending}
        disabled={!codeComplete(code)}
        onPress={() => submit()}
        style={styles.cta}
      />

      <Pressable
        feedback="subtle"
        accessibilityRole="button"
        accessibilityLabel={wait > 0 ? `Resend code in ${wait} seconds` : 'Resend code'}
        disabled={wait > 0 || resend.isPending}
        onPress={() =>
          resend.mutate(email, {
            onSuccess: () => {
              setWait(RESEND_AFTER_S);
              AccessibilityInfo.announceForAccessibility('We sent a new code.');
            },
          })
        }
        style={styles.resend}
      >
        <Text variant="footnote" color={wait > 0 ? 'textTertiary' : 'brand'}>
          {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </Text>
      </Pressable>
    </AuthShell>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  note: { marginTop: u(12) },
  cta: { marginTop: u(28) },
  resend: { alignSelf: 'center', marginTop: u(16), padding: u(8) },
}));
