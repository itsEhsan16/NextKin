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
import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';

import {
  emailSentNote,
  emptyPasswordDraft,
  EMAIL_SEND_FAILED,
  PASSWORD_CHANGED,
  PASSWORD_CHANGE_FAILED,
  SIGN_OUT_EVERYWHERE_FAILED,
  validateNewEmail,
  validatePasswordChange,
  type PasswordDraft,
} from '../accountForms';
import { EmailGroup, EmailGroupSkeleton } from '../components/EmailGroup';
import { PasswordGroup } from '../components/PasswordGroup';
import { SessionsGroup } from '../components/SessionsGroup';
import { useAccountActions } from '../hooks/useAccountActions';

const SIGN_OUT_MESSAGE =
  "Every device signed in to this account is signed out, this one included. You'll need to sign back in here.";

type Status = { message: string; tone?: 'neutral' | 'danger' } | undefined;

/**
 * Email, password and sessions (V2 §7.1, §8.4). No artboard draws it (plan §8), so it is
 * assembled from the built primitives alone: three `RowGroup` cards down one keyboard-aware
 * scroll, each owning its own action and its own answer.
 *
 * §8.4 is what shapes the middle group: only the identity provider ever holds a password, so the
 * app proxies the change and reports what comes back — it never verifies anything itself.
 *
 * Confirmation is printed under the group that earned it rather than raised as a toast. Nothing
 * above a pushed screen mounts a toast host — they live in the tab layout, which this screen sits
 * above in the stack — so a toast from here would never render at all. See `AccountStatusLine`.
 */
export function EmailPasswordScreen() {
  const { spacing } = useTheme();
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
    // The previous answer was about the previous address; it stops being true the moment the
    // reader starts typing another one.
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
        // The order is load-bearing, and it is `ProfileSheetsHost`'s: close the sheet and clear
        // the caches while the tree is still mounted, then flip the session LAST — that flip
        // fails the root layout's guard and unmounts everything this screen lives in, so
        // anything queued after it would run against a torn-down tree.
        //
        // The flip happens at all because this device is one of the sessions the server just
        // revoked (§7.1); staying signed in here would be a lie the next request finds out about.
        setConfirmOpen(false);
        resetSession();
        signOut();
      },
      // Closed on failure too, so the reason can be read: the sheet has nowhere to print one and
      // the SESSIONS group behind it does.
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
        header={<ScreenHeader title="Email & password" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
      >
        {children}
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
