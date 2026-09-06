import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useCurrentUser,
  useProfile,
  useUpdateAvatar,
  useUpdateName,
  useUpdateProfile,
} from '@/data/queries';
import { pickImage } from '@/lib';
import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { AvatarPickerRow } from '../components/AvatarPickerRow';
import { IdentityFields } from '../components/IdentityFields';
import { useProfileActions } from '../hooks/useProfileActions';
import {
  detailsChanged,
  identityDirty,
  identityDraft,
  nameChanged,
  namePatch,
  profilePatch,
  validateIdentity,
  type IdentityDraft,
} from '../identityForm';

/** V2 §7.6 forbids a silent failure; the reason goes on the bar that started the work. */
const SAVE_FAILED = "We couldn't save that. Check your connection and try again.";
const FIX_FIRST = 'Fix the highlighted fields to save.';
const AVATAR_FAILED = "That photo didn't save. Your old one is back — try again.";
const DISCARD = 'Your edits have not been saved. Going back now leaves your profile as it was.';

/** The photo card, the five fields and the account group, in the heights they settle at. */
const SKELETON_ROWS = [104, 76, 76, 112, 76, 82, 86];

function IdentitySkeleton() {
  const { spacing, s } = useTheme();
  return (
    <View style={{ gap: spacing[5] }}>
      {SKELETON_ROWS.map((height, index) => (
        <Skeleton key={index} height={s(height)} radius="card" />
      ))}
    </View>
  );
}

/**
 * Edit profile (V2 §7.3, personal info). No artboard draws it (plan §8), so it is assembled from
 * the built primitives alone.
 *
 * One page over two aggregates: the name and the photo belong to the user record, the headline,
 * location and years to the profile. Save fires only the write whose half actually changed, so
 * editing a headline never touches the account.
 */
export function EditProfileScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const actions = useProfileActions();

  const user = useCurrentUser();
  const profile = useProfile();
  const saveName = useUpdateName();
  const saveProfile = useUpdateProfile();
  const saveAvatar = useUpdateAvatar();

  /** What loaded, and what the reader has made of it. Dirty is the distance between the two. */
  const [base, setBase] = useState<IdentityDraft | undefined>(undefined);
  const [draft, setDraft] = useState<IdentityDraft | undefined>(undefined);
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [refused, setRefused] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Seeded once, not on every change of the cached aggregates: both writes are optimistic and
  // roll back on failure, and a re-seed on that rollback would discard the edit being retried.
  const seeded = useRef(false);
  const account = user.data;
  const current = profile.data;
  useEffect(() => {
    if (seeded.current || !account || !current) return;
    seeded.current = true;
    const next = identityDraft(account, current);
    setBase(next);
    setDraft(next);
  }, [account, current]);

  const check = draft ? validateIdentity(draft) : undefined;
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(check && !check.ok ? check.errors : {})) {
    if (refused || touched[key]) errors[key] = message;
  }

  const dirty = draft != null && base != null && identityDirty(draft, base);
  const failed = saveName.isError || saveProfile.isError;

  const change = useCallback((key: keyof IdentityDraft, value: string) => {
    setDraft((entry) => (entry ? { ...entry, [key]: value } : entry));
  }, []);
  const blurField = useCallback((key: keyof IdentityDraft) => {
    setTouched((entry) => ({ ...entry, [key]: true }));
  }, []);

  const requestBack = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else router.back();
  }, [dirty, router]);

  /**
   * The photo is committed the moment it is picked rather than held for Save. A picked photo is
   * already a decision — the reader chose it out of their own library — and holding it hostage to
   * a Save they may never press is the worse failure: they leave believing it changed. The write
   * is optimistic, so a refusal puts the old picture back where they can see it.
   */
  const changePhoto = useCallback(() => {
    void (async () => {
      const picked = await pickImage();
      if (picked) saveAvatar.mutate(picked.uri);
    })();
  }, [saveAvatar]);

  const submit = useCallback(() => {
    if (!draft || !base) return;
    if (!validateIdentity(draft).ok) {
      setRefused(true);
      return;
    }
    const writes: Promise<unknown>[] = [];
    if (nameChanged(draft, base)) writes.push(saveName.mutateAsync(namePatch(draft)));
    if (detailsChanged(draft, base)) writes.push(saveProfile.mutateAsync(profilePatch(draft)));
    // A rejection is already the mutations' error state, which the bar reads; caught here only so
    // it does not escape as an unhandled one.
    void Promise.all(writes)
      .then(() => router.back())
      .catch(() => undefined);
  }, [base, draft, router, saveName, saveProfile]);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Edit profile" onBack={requestBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* A sibling of the page, never a child of its scroller. */}
      <ConfirmSheet
        open={confirmOpen}
        title="Discard changes?"
        message={DISCARD}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmOpen(false);
          router.back();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );

  if (user.isError || profile.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void user.refetch();
          void profile.refetch();
        }}
      />,
    );
  }

  // Loading. The inert bar belongs to that state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land. There is no empty
  // state — a signed-in account always has a profile, and an unfilled field is the form at rest.
  if (!account || !current || !draft) {
    return page(
      <IdentitySkeleton />,
      <StickyActionBar primary={{ label: 'Save', disabled: true }} />,
    );
  }

  return page(
    <>
      <AvatarPickerRow
        name={`${account.firstName} ${account.lastName}`.trim()}
        source={account.avatarUrl}
        busy={saveAvatar.isPending}
        error={saveAvatar.isError ? AVATAR_FAILED : undefined}
        onPick={changePhoto}
      />

      <IdentityFields draft={draft} errors={errors} onChange={change} onBlurField={blurField} />

      <RowGroup title="ACCOUNT">
        <ListRow
          icon="envelope"
          label="Email"
          value={account.email}
          accessibilityHint="Opens email and password settings"
          onPress={actions.openAccountEmail}
        />
      </RowGroup>
    </>,
    <StickyActionBar
      note={failed ? SAVE_FAILED : Object.keys(errors).length > 0 ? FIX_FIRST : undefined}
      primary={{
        label: 'Save',
        loading: saveName.isPending || saveProfile.isPending,
        // A failure leaves the button live, so pressing it again is the retry.
        disabled: !dirty || check?.ok !== true,
        onPress: submit,
      }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
