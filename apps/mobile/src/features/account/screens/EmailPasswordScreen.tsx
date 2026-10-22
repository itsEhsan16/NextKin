import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useChangePassword,
  useCurrentUser,
  useResetSession,
  useSignOutEverywhere,
  useUpdateEmail,
} from '@/data/queries';
import { useSessionStore } from '@/features/auth';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';

import {
  emailSentNote,
  emptyPasswordDraft,
  EMAIL_PASSWORD_LEDE,
  EMAIL_PASSWORD_TITLE,
  EMAIL_SEND_FAILED,
  PASSWORD_CHANGED,
  PASSWORD_CHANGE_FAILED,
  SESSIONS_NOTE,
  SIGN_OUT_EVERYWHERE_FAILED,
  validateNewEmail,
  validatePasswordChange,
  type PasswordDraft,
} from '../accountForms';
import { EmailGroup, EmailGroupSkeleton } from '../components/EmailGroup';
import { AccountHero } from '../components/AccountHero';
import { PasswordGroup } from '../components/PasswordGroup';
import { SessionsGroup } from '../components/SessionsGroup';
import { useAccountActions } from '../hooks/useAccountActions';

const SIGN_OUT_MESSAGE = `${SESSIONS_NOTE} You'll need to sign back in here.`;

type Status = { message: string; tone?: 'neutral' | 'danger' } | undefined;

// ACCOUNT 01 at 390 (577:2462), in artboard units.
const HEADER_TO_HERO = 14 / 0.75;
const HERO_TO_CARDS = 24 / 0.75;
const CARD_GAP = 15 / 0.75;

/**
 * Email, password and sessions (V2 §7.1, §8.4), drawn as ACCOUNT 01 (577:2462): a hero that names
 * the page, then three cards down one keyboard-aware scroll, each owning its own action and its
 * own answer.
 * §8.4 shapes the middle group: only the identity provider ever holds a password, so the
 * app proxies the change and reports what comes back — it never verifies anything itself.
 * Confirmation is printed under the group that earned it, never as a toast, so it stays beside the
 * control long enough to be read. See `AccountStatusLine`.
 */
export function EmailPasswordScreen() {
  const { spacing, s } = useTheme();
  const actions = useAccountActions();

  const user = useCurrentUser();
  const updateEmail = useUpdateEmail();
  const changePassword = useChangePassword();
  const signOutEverywhere = useSignOutEverywhere();
  const resetSession = useResetSession();
  const signOut = useSessionStore((state) => state.signOut);

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [sentTo, setSentTo] = useState<string | undefined>(undefined);

  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [refused, setRefused] = useState(false);
  const [changed, setChanged] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const emailCheck = validateNewEmail(email, user.data?.email ?? '');
  const emailError = emailTouched && !emailCheck.ok ? emailCheck.errors.email : undefined;

  const passwordCheck = validatePasswordChange(draft);
  const passwordErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(passwordCheck.ok ? {} : passwordCheck.errors)) {
    if (refused || touched[key]) passwordErrors[key] = message;
  }

  const changeEmail = useCallback((value: string) => {
    setEmail(value);
    // The previous answer was about the previous address; it lapses on the next keystroke.
    setSentTo(undefined);
  }, []);

  const send = useCallback(() => {
    const account = user.data;
    if (!account) return;
    const address = email.trim();
    if (!validateNewEmail(address, account.email).ok) {
      setEmailTouched(true);
      return;
    }
    updateEmail.mutate(address, {
      onSuccess: () => {
        setSentTo(address);
        setEmail('');
        setEmailTouched(false);
      },
    });
  }, [email, updateEmail, user.data]);

  const changeField = useCallback((key: keyof PasswordDraft, value: string) => {
    setDraft((entry) => ({ ...entry, [key]: value }));
    setChanged(false);
  }, []);

  const blurField = useCallback((key: keyof PasswordDraft) => {
    setTouched((entry) => ({ ...entry, [key]: true }));
  }, []);

  const submitPassword = useCallback(() => {
    if (!validatePasswordChange(draft).ok) {
      setRefused(true);
      return;
    }
    changePassword.mutate(
      { current: draft.current, next: draft.next },
      {
        onSuccess: () => {
          setDraft(emptyPasswordDraft());
          setTouched({});
          setRefused(false);
          setChanged(true);
        },
      },
    );
  }, [changePassword, draft]);

  const endEverySession = useCallback(() => {
    signOutEverywhere.mutate(undefined, {
      onSuccess: () => {
        // Order is load-bearing (as in `ProfileSheetsHost`): close the sheet and clear caches
        // while mounted, then flip the session LAST — the flip unmounts this tree. It flips
        // because this device is one of the sessions the server just revoked (§7.1).
        setConfirmOpen(false);
        resetSession();
        signOut();
      },
      // Closed on failure too, so the Sessions card behind it can print the reason.
      onError: () => setConfirmOpen(false),
    });
  }, [resetSession, signOut, signOutEverywhere]);

  const emailStatus: Status = updateEmail.isError
    ? { message: EMAIL_SEND_FAILED, tone: 'danger' }
    : sentTo
      ? { message: emailSentNote(sentTo) }
      : undefined;

  const passwordStatus: Status = changePassword.isError
    ? { message: PASSWORD_CHANGE_FAILED, tone: 'danger' }
    : changed
      ? { message: PASSWORD_CHANGED }
      : undefined;

  const sessionStatus: Status = signOutEverywhere.isError
    ? { message: SIGN_OUT_EVERYWHERE_FAILED, tone: 'danger' }
    : undefined;

  const page = (children: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader title={EMAIL_PASSWORD_TITLE} showTitle={false} onBack={actions.goBack} />
        }
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        <AccountHero
          art={PROFILE_ROW_ART.emailPassword}
          artWidth={64}
          artGap={14}
          title={EMAIL_PASSWORD_TITLE}
          lede={EMAIL_PASSWORD_LEDE}
        />
        <View style={{ marginTop: s(HERO_TO_CARDS), gap: s(CARD_GAP) }}>{children}</View>
      </Screen>

      {/* A sibling of the page, never a child of its scroller: its root is an absolute fill. */}
      <ConfirmSheet
        open={confirmOpen}
        title="Sign out everywhere?"
        message={SIGN_OUT_MESSAGE}
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        busy={signOutEverywhere.isPending}
        onConfirm={endEverySession}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );

  if (user.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your account"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void user.refetch()}
      />,
    );
  }

  // There is no empty state: a signed-in account always has an email address, and three blank
  // password boxes are this form at rest rather than an absence of content.
  return page(
    <>
      {user.data ? (
        <EmailGroup
          currentEmail={user.data.email}
          value={email}
          onChange={changeEmail}
          onBlur={() => setEmailTouched(true)}
          error={emailError}
          status={emailStatus}
          busy={updateEmail.isPending}
          // A failure leaves the button live, so pressing it again is the retry.
          disabled={!emailCheck.ok}
          onSend={send}
        />
      ) : (
        <EmailGroupSkeleton />
      )}

      <PasswordGroup
        draft={draft}
        errors={passwordErrors}
        onChange={changeField}
        onBlurField={blurField}
        status={passwordStatus}
        busy={changePassword.isPending}
        disabled={!passwordCheck.ok}
        onSubmit={submitPassword}
      />

      <SessionsGroup status={sessionStatus} onSignOutEverywhere={() => setConfirmOpen(true)} />
    </>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
