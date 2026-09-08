import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import EmailIcon from '../../../../assets/icons/onboarding/field-email.svg';
import NameIcon from '../../../../assets/icons/onboarding/field-name.svg';
import PasswordIcon from '../../../../assets/icons/onboarding/field-password.svg';
import GoogleLogo from '../../../../assets/logos/google.svg';
import { blankSignUp, validateSignUp, FIX_FIRST, type SignUpDraft } from '../authForms';
import { board } from '../board';
import { SIGN_UP, dividerMargin } from '../signUpLayout';
import { AuthField } from '../components/AuthField';
import { AuthLockup } from '../components/AuthLockup';
import { useOnboardingStore } from '../onboardingStore';
import { useSessionStore } from '../sessionStore';
import { a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/**
 * Create an account (Figma 296:3032).
 *
 * **No safe-area edges, deliberately.** The artboard is a whole phone screen, so its own 97 of
 * head room and 130 of floor already cover the status bar and the gesture area. Asking for
 * `edges` as well adds those insets a second time — around 80dp of invented space, which is what
 * pushed the Google button down under the footer on the second device pass and made the footer
 * look as though it needed pinning. It does not: it flows with the page, 20.96 below the last
 * button, exactly where the board puts it.
 *
 * Nothing is fetched, so the loading, empty and error states the house recipe asks of a screen
 * have no query to hang off. What this ships instead is the form's own four — untouched, invalid
 * (per field, and a note under the button), submitting, and submitted. There is no identity
 * provider behind it either: any name, address and password sign you into the pre-seeded mock
 * account, and none of the three is kept, because the session store holds a status and no user.
 * See toreview.md.
 */
export function SignUpScreen() {
  const router = useRouter();
  const { colors, radii, sizes, s } = useTheme();
  const styles = useStyles();
  const signIn = useSessionStore((state) => state.signIn);
  const markSeen = useOnboardingStore((state) => state.markSeen);

  const [draft, setDraft] = useState<SignUpDraft>(blankSignUp);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [refused, setRefused] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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
    enter();
  };

  // The board sets the chevron beside the lock-up rather than above it, so it comes out of the
  // flow: stacked, its 48pt tap target pushed the whole page down by that much. The offset
  // centres that target on the 23.5 glyph the board draws, so the target stays a full 48.
  const backInset = (sizes.iconButton - s(board(SIGN_UP.backGlyph))) / 2;

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
        <IconButton icon="arrow-left" label="Go back" variant="ghost" onPress={() => router.back()} />
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
          renderIcon={(props) => <NameIcon {...props} />}
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
          renderIcon={(props) => <EmailIcon {...props} />}
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
          renderIcon={(props) => <PasswordIcon {...props} />}
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

      <Pressable
        haptic="medium"
        accessibilityRole="button"
        accessibilityLabel="Create account"
        onPress={submit}
        style={[
          styles.pill,
          {
            height: s(board(SIGN_UP.ctaHeight)),
            marginTop: s(board(SIGN_UP.ctaTop)),
            borderRadius: radii.full,
            backgroundColor: colors.ctaPrimary,
          },
        ]}
      >
        <Text variant="authCta" color="ctaPrimaryLabel">
          Create account
        </Text>
        <FontAwesome5
          name="arrow-right"
          size={s(board(SIGN_UP.ctaArrow))}
          color={colors.ctaPrimaryLabel}
          style={{ position: 'absolute', right: s(board(SIGN_UP.ctaArrowRight)) }}
        />
      </Pressable>

      {refused && !validation.ok ? (
        <Text
          variant="authMeta"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          style={{ marginTop: s(board(8)) }}
        >
          {FIX_FIRST}
        </Text>
      ) : null}

      <View
        style={[
          styles.divider,
          { marginVertical: s(board(dividerMargin)), gap: s(board(SIGN_UP.fieldGap)) },
        ]}
      >
        <View style={[styles.rule, { height: s(board(SIGN_UP.hairline)), backgroundColor: colors.authFieldBorder }]} />
        <Text variant="authField" color="textTertiary">
          or
        </Text>
        <View style={[styles.rule, { height: s(board(SIGN_UP.hairline)), backgroundColor: colors.authFieldBorder }]} />
      </View>

      <Pressable
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={enter}
        style={[
          styles.pill,
          {
            height: s(board(SIGN_UP.googleHeight)),
            borderRadius: radii.full,
            gap: s(board(SIGN_UP.googleGap)),
            borderWidth: s(board(SIGN_UP.hairline)),
            borderColor: colors.authFieldBorder,
            backgroundColor: colors.surfaceCard,
          },
        ]}
      >
        <GoogleLogo width={s(board(SIGN_UP.googleLogo))} height={s(board(SIGN_UP.googleLogo))} />
        <Text variant="authButton" color="onboardingInk">
          Continue with Google
        </Text>
      </Pressable>

      {/* In the flow, not pinned: the board puts it 34.14 under the last button. */}
      <Pressable
        feedback="none"
        accessibilityRole="link"
        accessibilityLabel="Already have an account? Sign in"
        hitSlop={hitSlopFor(s(board(18)))}
        onPress={() => router.push('/(auth)/sign-in')}
        style={[
          styles.footer,
          {
            marginTop: s(board(SIGN_UP.footerTop)),
            marginBottom: s(board(SIGN_UP.floor)),
            gap: s(board(4.3)),
          },
        ]}
      >
        <Text variant="authMeta" color="textTertiary">
          Already have an account?
        </Text>
        <Text variant="authMetaStrong" color="onboardingInk">
          Sign in
        </Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
