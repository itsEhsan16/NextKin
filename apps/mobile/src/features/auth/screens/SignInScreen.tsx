import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View, type TextInputInstance } from 'react-native';

import { backendAuth, usePasswordSignIn } from '@/data/queries';

import {
  blankSignIn,
  validateSignIn,
  FIX_FIRST,
  GOOGLE_NOT_CONNECTED,
  signInErrorMessage,
  type SignInDraft,
} from '../authForms';
import { board } from '../board';
import { AuthDivider } from '../components/AuthDivider';
import { AuthCta } from '../components/AuthCta';
import { AuthField } from '../components/AuthField';
import { AuthFooterLink } from '../components/AuthFooterLink';
import { AuthLockup } from '../components/AuthLockup';
import { GoogleButton } from '../components/GoogleButton';
import { useOnboardingStore } from '../onboardingStore';
import { useSessionStore } from '../sessionStore';
import { SIGN_IN, signInDividerMargin } from '../signInLayout';
import { a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { glyphSpan } from '@/ui/Icon';

/**
 * What the reset link would say, said instead. V2 §7.1 puts the whole flow behind Cognito — a
 * time-limited, single-use code sent by mail — so there is no part of it a mock data layer can
 * honestly stand in for, and a link that silently did nothing would be worse than one that
 * explains itself.
 */
const RESET = {
  title: 'Password reset needs a real account',
  message:
    'Resetting a password means a single-use link emailed by our identity provider (V2 §7.1). ' +
    'This build has no server and no accounts behind it — any email and password sign you into ' +
    'the same pre-seeded demo account, so there is nothing to recover.',
};

/**
 * Sign in (Figma 309:175).
 *
 * The screen §6.6 of toreview.md was waiting for: until this artboard landed, both "Sign in"
 * affordances in the flow pointed at a stand-in that said out loud it was design-gated.
 *
 * **No safe-area edges, deliberately** — the reason `SignUpScreen` sets out. The artboard is a
 * whole phone screen: 97 of head room down to a 131 floor, summing to its own 895, so the
 * padding at each end is already the allowance for the status bar and the gesture area. Asking
 * for `edges` as well adds them a second time.
 *
 * Nothing is fetched, so the loading, empty and error states the house recipe asks of a screen
 * have no query to hang off. What this ships instead is the form's own three — untouched,
 * invalid (per field, and a note under the button), and accepted. There is no submitting state:
 * signing in is a synchronous store flip, so there is no moment to show one in. There is no identity
 * provider behind it either: any address and password sign you into the pre-seeded mock account,
 * and neither is kept, because the session store holds a status and no user.
 */
export function SignInScreen() {
  const router = useRouter();
  const { sizes, s } = useTheme();
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
  // Only the messages the reader has earned: a blurred field, or a refused submit. An error on
  // the first keystroke reads as a telling-off — the rule `useEntryForm` established.
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const patch = (part: Partial<SignInDraft>) => setDraft((current) => ({ ...current, ...part }));
  const blur = (key: string) => setTouched((current) => ({ ...current, [key]: true }));

  // Signing in flips the root layout's guard, which unmounts this group and lands on the tabs.
  // There is no navigation call to make: the gate is a pure state flip. `markSeen` goes with it
  // so that signing out later returns to this screen rather than replaying the slides.
  const enter = () => {
    markSeen();
    signIn();
  };

  const submit = () => {
    if (!validation.ok) {
      setRefused(true);
      // The note below carries `accessibilityLiveRegion`, which is Android-only, and `refused`
      // latches — so on the second refused press nothing changes and even Android would stay
      // silent. Announcing here covers both, the way TextField announces a new error.
      AccessibilityInfo.announceForAccessibility(FIX_FIRST);
      return;
    }
    // On the mock any details sign you in, synchronously, as before. On the backend (P5-08) the
    // local identity provider checks them first; a refusal is said under the button.
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
  const backGlyph = s(board(SIGN_IN.backGlyph));
  const backInset = (sizes.iconButton - backGlyph) / 2;

  return (
    <>
      <Screen
        keyboard
        scroll
        edges={[]}
        padded={false}
        contentContainerStyle={{ paddingHorizontal: s(board(SIGN_IN.gutter)) }}
      >
        <View
          style={{
            position: 'absolute',
            left: s(board(SIGN_IN.backX)) - backInset,
            top: s(board(SIGN_IN.backY)) - backInset,
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
          {...a11yHeader('Sign in')}
          style={[styles.centred, { marginTop: s(board(SIGN_IN.headingTop)) }]}
        >
          <Text variant="title1" color="onboardingInk" align="center">
            Sign in
          </Text>
        </View>

        <View style={{ marginTop: s(board(SIGN_IN.fieldsTop)), gap: s(board(SIGN_IN.fieldGap)) }}>
          <AuthField
            label="Email address"
            metrics={SIGN_IN}
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
            metrics={SIGN_IN}
            icon="Lock01"
            value={draft.password}
            onChangeText={(password) => patch({ password })}
            onBlur={() => blur('password')}
            error={errors.password}
            secure
            autoComplete="current-password"
            returnKeyType="done"
            onSubmit={submit}
          />
        </View>

        <Pressable
          // The rows' slight press, so the tap is felt before the sheet answers it (§85).
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Forgot password?"
          hitSlop={hitSlopFor(s(board(SIGN_IN.forgotHeight)))}
          onPress={() => setResetOpen(true)}
          style={[
            styles.forgot,
            {
              marginTop: s(board(SIGN_IN.forgotTop)),
              marginBottom: s(board(SIGN_IN.forgotFloor)),
            },
          ]}
        >
          <Text variant="callout" color="textSecondary" style={styles.underline}>
            Forgot password?
          </Text>
        </Pressable>

        <AuthCta
          label="Sign In"
          onPress={submit}
          loading={signInRequest.isPending}
          height={s(board(SIGN_IN.ctaHeight))}
          arrow={s(board(SIGN_IN.ctaArrow))}
          arrowRight={s(board(SIGN_IN.ctaArrowRight))}
          style={{ marginTop: s(board(SIGN_IN.ctaTop)) }}
        />

        {(refused && !validation.ok) || serverError ? (
          <Text
            variant="callout"
            color="danger"
            align="center"
            accessibilityLiveRegion="polite"
            style={{ marginTop: s(board(SIGN_IN.fieldErrorGap)) }}
          >
            {refused && !validation.ok ? FIX_FIRST : serverError}
          </Text>
        ) : null}

        <AuthDivider
          margin={signInDividerMargin}
          gap={SIGN_IN.dividerGap}
          hairline={SIGN_IN.hairline}
        />

        <GoogleButton
          height={SIGN_IN.googleHeight}
          logo={SIGN_IN.googleLogo}
          gap={SIGN_IN.googleGap}
          hairline={SIGN_IN.hairline}
          onPress={google}
        />

        <AuthFooterLink
          prompt="Don’t have an account?"
          action="Create one"
          top={SIGN_IN.footerTop}
          height={SIGN_IN.footerHeight}
          gap={SIGN_IN.footerGap}
          floor={SIGN_IN.floor}
          // Replace, not push, and sign-up's footer replaces back (§85): the two forms swap in
          // place, so however often the reader switches, back leaves for where they came from.
          onPress={() => router.replace('/(auth)/sign-up')}
        />
      </Screen>

      {/* A sibling of the page, never a child of its scroller: the sheet's root is an absolute fill. */}
      <ConfirmSheet
        open={resetOpen}
        tone="neutral"
        title={RESET.title}
        message={RESET.message}
        confirmLabel="Back to sign in"
        cancelLabel="Close"
        onConfirm={() => setResetOpen(false)}
        onCancel={() => setResetOpen(false)}
      />
    </>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
  forgot: { alignSelf: 'flex-end' },
  underline: { textDecorationLine: 'underline' },
}));
