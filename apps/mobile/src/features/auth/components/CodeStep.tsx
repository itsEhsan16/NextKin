import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { useConfirmSignUp, useResendSignUpCode } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { CODE_LENGTH, codeComplete, confirmErrorMessage } from '../authForms';
import { CodeBoxes } from './CodeBoxes';

const RESEND_AFTER_S = 30;
/** How long the green boxes show before the app moves on. */
const SUCCESS_HOLD_MS = 900;

export type CodeStepProps = {
  email: string;
  password: string;
  /**
   * The code was right: sign in. `newAccount` is false when the code only finished a sign-in on a
   * new device (Clerk, §173), so the caller skips the first run then.
   */
  onDone: (newAccount: boolean) => void;
  /** Back to the form, to fix the address. */
  onChangeEmail: () => void;
};

/**
 * The email code, on the sign-up or sign-in screen itself (owner, 2026-11-08, §184) instead of a
 * screen of its own. Six boxes; a full code is checked at once; a right code turns the boxes
 * green before signing in; a wrong one shakes and says why. Resend unlocks after 30 seconds.
 */
export function CodeStep({ email, password, onDone, onChangeEmail }: CodeStepProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const confirm = useConfirmSignUp();
  const resend = useResendSignUpCode();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  useEffect(() => () => void (done.current && clearTimeout(done.current)), []);

  const submit = (value: string) => {
    if (confirm.isPending || success || !codeComplete(value)) return;
    confirm.mutate(
      { email, password, code: value },
      {
        onSuccess: (result) => {
          setSuccess(true);
          AccessibilityInfo.announceForAccessibility('Email confirmed.');
          const newAccount = result?.newAccount ?? true;
          done.current = setTimeout(() => onDone(newAccount), SUCCESS_HOLD_MS);
        },
        onError: (failure) => {
          const text = confirmErrorMessage(failure);
          setError(text);
          AccessibilityInfo.announceForAccessibility(text);
        },
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <Text variant="bodyLg" color="textSecondary" align="center">
        {`Enter the ${CODE_LENGTH}-digit code we sent to `}
        <Text variant="bodyLgStrong" color="ink">
          {email}
        </Text>
      </Text>

      <CodeBoxes
        length={CODE_LENGTH}
        value={code}
        error={error != null}
        success={success}
        disabled={confirm.isPending}
        onChange={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        onComplete={submit}
      />

      <View style={styles.status} accessibilityLiveRegion="polite">
        {success ? (
          <View style={styles.row}>
            <Icon name="CheckCircle" size={u(18)} color={colors.success} />
            <Text variant="callout" color="success">
              Email confirmed
            </Text>
          </View>
        ) : confirm.isPending ? (
          <Text variant="callout" color="textSecondary">
            Checking the code…
          </Text>
        ) : error ? (
          <Text variant="callout" color="danger" align="center">
            {error}
          </Text>
        ) : null}
      </View>

      {success ? null : (
        <View style={styles.links}>
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
            style={styles.link}
          >
            <Text variant="callout" color={wait > 0 ? 'textTertiary' : 'brand'}>
              {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
            </Text>
          </Pressable>
          <Pressable
            feedback="subtle"
            accessibilityRole="button"
            accessibilityLabel="Use a different email"
            onPress={onChangeEmail}
            style={styles.link}
          >
            <Text variant="callout" color="brand">
              Use a different email
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(20) },
  status: { minHeight: u(24), alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { paddingVertical: u(8) },
}));
