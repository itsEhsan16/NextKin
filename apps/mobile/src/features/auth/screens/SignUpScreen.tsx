import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View, type TextInputInstance } from 'react-native';

import { backendAuth, useStartSignUp } from '@/data/queries';

import {
  blankSignUp,
  validateSignUp,
  FIX_FIRST,
  GOOGLE_NOT_CONNECTED,
  signUpErrorMessage,
  type SignUpDraft,
} from '../authForms';
import { usePendingSignUp } from '../pendingSignUp';
import { board } from '../board';
import { SIGN_UP, dividerMargin } from '../signUpLayout';
import { AuthDivider } from '../components/AuthDivider';
import { AuthCta } from '../components/AuthCta';
import { AuthField } from '../components/AuthField';
import { AuthFooterLink } from '../components/AuthFooterLink';
import { AuthLockup } from '../components/AuthLockup';
import { GoogleButton } from '../components/GoogleButton';
import { useOnboardingStore } from '../onboardingStore';
import { useSessionStore } from '../sessionStore';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { glyphSpan } from '@/ui/Icon';

/**
 * Create an account (Figma 307:4386).
 *
 * **No safe-area edges, deliberately.** The artboard is a whole phone screen, so its own 97 of
 * head room and 130 of floor already cover the status bar and the gesture area. Asking for
 * `edges` as well adds those insets a second time — around 80dp of invented space, which is what
 * pushed the Google button down under the footer on the second device pass and made the footer
 * look as though it needed pinning. It does not: it flows with the page, 20.96 below the last
 * button, exactly where the board puts it.
 *
 * Nothing is fetched, so the loading, empty and error states the house recipe asks of a screen
 * have no query to hang off. What this ships instead is the form's own three — untouched,
 * invalid (per field, and a note under the button), and accepted. There is no submitting state:
 * signing in is a synchronous store flip, so there is no moment to show one in. There is no identity
 * provider behind it either: any name, address and password sign you into the pre-seeded mock
 * account, and none of the three is kept, because the session store holds a status and no user.
 * See toreview.md.
 */
export function SignUpScreen() {
  const router = useRouter();
  const { sizes, s } = useTheme();
  const styles = useStyles();
  const signIn = useSessionStore((state) => state.signIn);
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
  // Only the messages the reader has earned: a blurred field, or a refused submit. An error on
  // the first keystroke reads as a telling-off — the rule `useEntryForm` established.
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const patch = (part: Partial<SignUpDraft>) => setDraft((current) => ({ ...current, ...part }));
  const blur = (key: string) => setTouched((current) => ({ ...current, [key]: true }));

  // Signing in flips the root layout's guard, which unmounts this group and lands on the tabs.
  // There is no navigation call to make: the gate is a pure state flip.
  const enter = () => {
    markSeen();
    signIn();
  };

  const submit = () => {
    if (!validation.ok) {
      setRefused(true);
      return;
    }
    // On the mock any details sign you in, synchronously, as before. On the backend (P5-08) the
    // account is created and a code emailed; the confirm screen finishes the sign-up.
    if (!backendAuth) {
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

  const google = () => {
    if (!backendAuth) {
      enter();
      return;
    }
    setServerError(GOOGLE_NOT_CONNECTED);
    AccessibilityInfo.announceForAccessibility(GOOGLE_NOT_CONNECTED);
  };

  // The board sets the chevron beside the lock-up rather than above it, so it comes out of the
  // flow: stacked, its 48pt tap target pushed the whole page down by that much. The offset
  // centres that target on the 23.5 glyph the board draws, so the target stays a full 48 — and
  // the glyph is asked for at that size, because IconButton's own default is a 16 read off the
  // 520 board, which is barely half of what this one is drawn at.
  const backGlyph = s(board(SIGN_UP.backGlyph));
  const backInset = (sizes.iconButton - backGlyph) / 2;

  return (
    <Screen
      keyboard
      scroll
      edges={[]}
      padded={false}
      contentContainerStyle={{ paddingHorizontal: s(board(SIGN_UP.gutter)) }}
    >
      <View
        style={{
          position: 'absolute',
          left: s(board(SIGN_UP.backX)) - backInset,
          top: s(board(SIGN_UP.backY)) - backInset,
          zIndex: 1,
        }}
      >
        <IconButton
          icon="ArrowLeft"
          label="Go back"
          variant="ghost"
          iconSize={backGlyph / glyphSpan.chevron}
          onPress={() => router.back()}
        />
      </View>

      <AuthLockup />

      <View
        accessible
        {...a11yHeader('Create an account')}
        style={[styles.centred, { marginTop: s(board(SIGN_UP.headingTop)) }]}
      >
        <Text variant="authTitle" color="onboardingInk" align="center">
          Create an account
        </Text>
      </View>

      <View style={{ marginTop: s(board(SIGN_UP.fieldsTop)), gap: s(board(SIGN_UP.fieldGap)) }}>
        <AuthField
          label="Full name"
          metrics={SIGN_UP}
          icon="User01"
          value={draft.fullName}
          onChangeText={(fullName) => patch({ fullName })}
          onBlur={() => blur('fullName')}
          error={errors.fullName}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmit={() => emailRef.current?.focus()}
        />
        <AuthField
          ref={emailRef}
          label="Email address"
          metrics={SIGN_UP}
          icon="Mail01"
          value={draft.email}
          onChangeText={(email) => patch({ email })}
          onBlur={() => blur('email')}
          error={errors.email}
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
          onSubmit={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          label="Password"
          metrics={SIGN_UP}
          icon="Lock01"
          value={draft.password}
          onChangeText={(password) => patch({ password })}
          onBlur={() => blur('password')}
          error={errors.password}
          secure
          autoComplete="new-password"
          returnKeyType="done"
          onSubmit={submit}
        />
      </View>

      <AuthCta
        label="Create account"
        onPress={submit}
        loading={startSignUp.isPending}
        height={s(board(SIGN_UP.ctaHeight))}
        arrow={s(board(SIGN_UP.ctaArrow))}
        arrowRight={s(board(SIGN_UP.ctaArrowRight))}
        style={{ marginTop: s(board(SIGN_UP.ctaTop)) }}
      />

      {(refused && !validation.ok) || serverError ? (
        <Text
          variant="authMeta"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          style={{ marginTop: s(board(8)) }}
        >
          {refused && !validation.ok ? FIX_FIRST : serverError}
        </Text>
      ) : null}

      <AuthDivider margin={dividerMargin} gap={SIGN_UP.fieldGap} hairline={SIGN_UP.hairline} />

      <GoogleButton
        height={SIGN_UP.googleHeight}
        logo={SIGN_UP.googleLogo}
        gap={SIGN_UP.googleGap}
        hairline={SIGN_UP.hairline}
        onPress={google}
      />

      <AuthFooterLink
        prompt="Already have an account?"
        action="Sign in"
        top={SIGN_UP.footerTop}
        height={SIGN_UP.footerHeight}
        gap={4.3}
        floor={SIGN_UP.floor}
        // Replace, as sign-in's own footer does: one form swaps for the other in place. This one
        // pushed, so a round trip left two sign-up screens on the stack, and back from the second
        // landed on the first rather than where the reader came from (§85).
        onPress={() => router.replace('/(auth)/sign-in')}
      />
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
}));
