import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View, type TextInputInstance } from 'react-native';

import { backendAuth, beginMockAccount, useStartSignUp } from '@/data/queries';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import {
  blankSignUp,
  FIX_FIRST,
  PASSWORD_HINT,
  signUpErrorMessage,
  validateSignUp,
  type SignUpDraft,
} from '../authForms';
import { AuthFooter } from '../components/AuthFooter';
import { AuthShell } from '../components/AuthShell';
import { useFirstRunStore } from '../firstRunStore';
import { useOnboardingStore } from '../onboardingStore';
import { usePendingSignUp } from '../pendingSignUp';
import { useSessionStore } from '../sessionStore';

/**
 * Create an account (toreview.md §172). Three fields, the password rule shown up front, errors
 * on the field once it has been left, one button. On the backend a code is emailed and the
 * confirm screen finishes the sign-up; on the mock it signs straight in as a new user.
 */
export function SignUpScreen() {
  const router = useRouter();
  const styles = useStyles();
  const signIn = useSessionStore((state) => state.signIn);
  const markFirstRun = useFirstRunStore((state) => state.mark);
  const markSeen = useOnboardingStore((state) => state.markSeen);

  const [draft, setDraft] = useState<SignUpDraft>(blankSignUp);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [refused, setRefused] = useState(false);
  const startSignUp = useStartSignUp();
  const startPending = usePendingSignUp((state) => state.start);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const validation = validateSignUp(draft);
  const allErrors = validation.ok ? {} : validation.errors;
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const patch = (part: Partial<SignUpDraft>) => setDraft((current) => ({ ...current, ...part }));
  const blur = (key: string) => setTouched((current) => ({ ...current, [key]: true }));

  const enter = () => {
    markSeen();
    markFirstRun();
    signIn();
  };

  const submit = () => {
    if (!validation.ok) {
      setRefused(true);
      AccessibilityInfo.announceForAccessibility(FIX_FIRST);
      return;
    }
    if (!backendAuth) {
      beginMockAccount(draft.fullName, draft.email);
      enter();
      return;
    }
    if (startSignUp.isPending) return;
    setServerError(null);
    startSignUp.mutate(
      { name: draft.fullName, email: draft.email, password: draft.password },
      {
        onSuccess: () => {
          startPending(draft.email.trim(), draft.password);
          router.push('/confirm-email');
        },
        onError: (error) => {
          const message = signUpErrorMessage(error);
          setServerError(message);
          AccessibilityInfo.announceForAccessibility(message);
        },
      },
    );
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <AuthFooter
          prompt="Have an account?"
          action="Sign in"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      }
    >
      <View style={styles.fields}>
        <TextField
          label="Full name"
          icon="User01"
          placeholder="Your name"
          value={draft.fullName}
          onChangeText={(fullName) => patch({ fullName })}
          onBlur={() => blur('fullName')}
          error={errors.fullName}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmit={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          icon="Mail01"
          placeholder="you@example.com"
          value={draft.email}
          onChangeText={(email) => patch({ email })}
          onBlur={() => blur('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmit={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          icon="Lock01"
          value={draft.password}
          onChangeText={(password) => patch({ password })}
          onBlur={() => blur('password')}
          error={errors.password}
          helper={errors.password ? undefined : PASSWORD_HINT}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmit={submit}
        />
      </View>

      <Button
        label="Create account"
        size="xl"
        block
        loading={startSignUp.isPending}
        onPress={submit}
        style={styles.cta}
      />

      {serverError ? (
        <Text
          variant="footnote"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {serverError}
        </Text>
      ) : null}

      <Text variant="footnote" color="textTertiary" align="center" style={styles.terms}>
        By continuing you agree to our Terms and Privacy Policy.
      </Text>
    </AuthShell>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  fields: { gap: u(16) },
  cta: { marginTop: u(28) },
  error: { marginTop: u(12) },
  terms: { marginTop: u(16) },
}));
