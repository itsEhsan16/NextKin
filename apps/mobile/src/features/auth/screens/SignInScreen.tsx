import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View, type TextInputInstance } from 'react-native';

import { backendAuth, usePasswordSignIn } from '@/data/queries';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import {
  blankSignIn,
  FIX_FIRST,
  signInErrorMessage,
  validateSignIn,
  type SignInDraft,
} from '../authForms';
import { AuthFooter } from '../components/AuthFooter';
import { AuthShell } from '../components/AuthShell';
import { useOnboardingStore } from '../onboardingStore';
import { useSessionStore } from '../sessionStore';

/** Self-serve reset is not in the app yet; say so plainly instead of a dead link (§172). */
const RESET = {
  title: 'Reset your password',
  message: 'Password reset in the app is coming soon. Until then, contact support and we’ll help.',
};

/** Sign in (toreview.md §172): the same shell as sign-up, two fields, one button. */
export function SignInScreen() {
  const router = useRouter();
  const styles = useStyles();
  const signIn = useSessionStore((state) => state.signIn);
  const markSeen = useOnboardingStore((state) => state.markSeen);

  const [draft, setDraft] = useState<SignInDraft>(blankSignIn);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [refused, setRefused] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const signInRequest = usePasswordSignIn();
  const [serverError, setServerError] = useState<string | null>(null);

  const passwordRef = useRef<TextInputInstance>(null);

  const validation = validateSignIn(draft);
  const allErrors = validation.ok ? {} : validation.errors;
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const patch = (part: Partial<SignInDraft>) => setDraft((current) => ({ ...current, ...part }));
  const blur = (key: string) => setTouched((current) => ({ ...current, [key]: true }));

  const enter = () => {
    markSeen();
    signIn();
  };

  const submit = () => {
    if (!validation.ok) {
      setRefused(true);
      AccessibilityInfo.announceForAccessibility(FIX_FIRST);
      return;
    }
    if (!backendAuth) {
      enter();
      return;
    }
    if (signInRequest.isPending) return;
    setServerError(null);
    signInRequest.mutate(draft, {
      onSuccess: enter,
      onError: (error) => {
        const message = signInErrorMessage(error);
        setServerError(message);
        AccessibilityInfo.announceForAccessibility(message);
      },
    });
  };

  return (
    <>
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to pick up where you left off."
        footer={
          <AuthFooter
            prompt="New to NextKin?"
            action="Create account"
            onPress={() => router.replace('/(auth)/sign-up')}
          />
        }
      >
        <View style={styles.fields}>
          <TextField
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
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="done"
            onSubmit={submit}
          />
        </View>

        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Forgot password?"
          onPress={() => setResetOpen(true)}
          style={styles.forgot}
        >
          <Text variant="footnote" color="brand">
            Forgot password?
          </Text>
        </Pressable>

        <Button
          label="Sign in"
          size="xl"
          block
          loading={signInRequest.isPending}
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

        {!backendAuth ? (
          <Text variant="footnote" color="textTertiary" align="center" style={styles.error}>
            Demo build: any email and password work.
          </Text>
        ) : null}
      </AuthShell>

      <ConfirmSheet
        open={resetOpen}
        tone="neutral"
        title={RESET.title}
        message={RESET.message}
        confirmLabel="Got it"
        cancelLabel="Close"
        onConfirm={() => setResetOpen(false)}
        onCancel={() => setResetOpen(false)}
      />
    </>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  fields: { gap: u(16) },
  forgot: { alignSelf: 'flex-end', paddingVertical: u(10) },
  cta: { marginTop: u(12) },
  error: { marginTop: u(12) },
}));
