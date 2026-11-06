import {
  AVAILABILITY_LABEL,
  LANGUAGE_LABEL,
  type Availability,
  type Language,
  type ProfilePreferences,
} from '@/data/models';
import {
  useCompleteNextStep,
  useDeleteAccount,
  useProfile,
  useResetSession,
  useUpdatePreferences,
} from '@/data/queries';
import { useSessionStore } from '@/features/auth';
import { formatLakh } from '@/lib';
import { ConfirmArt, ConfirmSheet } from '@/ui/ConfirmSheet';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { Art, EntryTile } from './components/cards';
import { NEXT_STEP } from './nextSteps';
import { PROFILE_DANGER_ART, PROFILE_ROW_ART as ART } from './profileRowArt';
import { useProfileStore } from './profileStore';
import type { LineIconName } from '@/ui/Icon';

/**
 * The pickers close on the tap and write optimistically, so a refused write flips the choice back
 * after the sheet has gone. It used to do that without a word; now it says so (§85).
 */
export const PREFERENCE_REVERTED = "Couldn't save — changed back";

/** V2 §7.6 forbids a silent failure. The sheet stays up, so pressing Delete again is the retry. */
export const DELETE_ACCOUNT_FAILED =
  "We couldn't delete your account. Check your connection and try again.";

const glyph = (icon: LineIconName) => <EntryTile tile={{ kind: 'glyph', icon }} size="sm" />;

/** Under a theme the app does not have yet; the web Settings picker says the same. */
export const APPEARANCE_COMING_SOON = 'Coming soon';

/**
 * The app is light only (owner, 2026-10-25), so Light is the one choosable row. System and Dark
 * stay on the board's sheet, greyed out, until a dark design exists.
 */
const APPEARANCE_OPTIONS: readonly SheetOption<'system' | 'light' | 'dark'>[] = [
  {
    key: 'system',
    label: 'System',
    caption: APPEARANCE_COMING_SOON,
    leading: glyph('Phone01'),
    disabled: true,
  },
  { key: 'light', label: 'Light', leading: glyph('Sun') },
  {
    key: 'dark',
    label: 'Dark',
    caption: APPEARANCE_COMING_SOON,
    leading: glyph('Moon01'),
    disabled: true,
  },
];

const LANGUAGE_OPTIONS: readonly SheetOption<Language>[] = (['en', 'de'] as const).map((key) => ({
  key,
  label: LANGUAGE_LABEL[key],
  leading: <EntryTile tile={{ kind: 'code', code: key.toUpperCase() }} size="sm" />,
}));

/** Under the job-preference pickers, as under their group on Profile (577:503). */
const MATCHING_ONLY = 'Only used for matching — never shown on your resume.';

/** The sheet header's art: the row's own icon, drawn larger (40 at 390; 36 for Availability). */
const headerArt = (art: (typeof ART)[keyof typeof ART], at390 = 40) => (
  <Art art={art} width={at390 / 0.75} />
);

const AVAILABILITY_OPTIONS: readonly SheetOption<Availability>[] = (
  ['immediately', '2_weeks', '1_month', 'open_to_offers', 'not_looking'] as const
).map((key) => ({ key, label: AVAILABILITY_LABEL[key] }));

/** Annual INR floors offered by the minimum-salary picker; 'none' clears the preference. */
const SALARY_STEPS = [
  1_000_000, 1_500_000, 2_000_000, 2_400_000, 3_000_000, 4_000_000, 5_000_000,
] as const;

const SALARY_OPTIONS: readonly SheetOption[] = [
  { key: 'none', label: 'No minimum' },
  ...SALARY_STEPS.map((amount) => ({ key: String(amount), label: formatLakh(amount) })),
];

/**
 * Mounts the Profile screen's sheets once, above the tab bar and the FAB, alongside the
 * filters and resume-menu hosts. Appearance shows Light as the only theme (nothing to save); the
 * preference pickers write through the profile repo; sign-out and delete-account now end the
 * mock session for real and drop the app onto the design-gated sign-in screen (plan §Phase 9A).
 */
export function ProfileSheetsHost() {
  const sheet = useProfileStore((state) => state.sheet);
  const open = useProfileStore((state) => state.sheetOpen);
  const closeSheet = useProfileStore((state) => state.closeSheet);

  const profile = useProfile();
  const updatePreferences = useUpdatePreferences();
  const completeStep = useCompleteNextStep();
  const prefs = profile.data?.preferences;
  // The toast host sits above every sheet in the tabs layout, so it reads over this one.
  const showToast = useProfileStore((state) => state.showToast);

  /** Resolves the saved profile, or undefined once the refusal has been said. */
  const savePreferences = (patch: Partial<ProfilePreferences>) =>
    updatePreferences.mutateAsync(patch).catch(() => {
      showToast(PREFERENCE_REVERTED, 'error');
      return undefined;
    });

  const deleteAccount = useDeleteAccount();
  const resetSession = useResetSession();
  const signOut = useSessionStore((state) => state.signOut);
  // Named apart from the mutation above: one asks the server to delete the account, the other
  // ends the session on this device once it has.
  const endAccount = useSessionStore((state) => state.deleteAccount);

  if (!sheet) return null;

  switch (sheet) {
    case 'appearance':
      return (
        <OptionSheet
          open={open}
          title="Appearance"
          variant="card"
          art={headerArt(ART.appearance)}
          options={APPEARANCE_OPTIONS}
          selectedKey="light"
          // Light is the only row that can be picked, and it is already the theme.
          onSelect={closeSheet}
          onClose={closeSheet}
        />
      );
    case 'language':
      return (
        <OptionSheet
          open={open}
          title="Language"
          variant="card"
          art={headerArt(ART.language)}
          options={LANGUAGE_OPTIONS}
          selectedKey={prefs?.language}
          onSelect={(key) => {
            void savePreferences({ language: key });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'availability':
      return (
        <OptionSheet
          open={open}
          title="Availability"
          variant="card"
          art={headerArt(ART.availability, 36)}
          footnote={MATCHING_ONLY}
          options={AVAILABILITY_OPTIONS}
          selectedKey={prefs?.availability}
          onSelect={(key) => {
            void savePreferences({ availability: key });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'min-salary':
      return (
        <OptionSheet
          open={open}
          title="Minimum salary"
          variant="card"
          art={headerArt(ART.minSalary)}
          footnote={MATCHING_ONLY}
          options={SALARY_OPTIONS}
          selectedKey={prefs?.minSalary?.min != null ? String(prefs.minSalary.min) : 'none'}
          onSelect={(key) => {
            const floor = key === 'none' ? undefined : Number(key);
            void savePreferences({
              minSalary:
                floor == null ? undefined : { min: floor, currency: 'INR', period: 'year' },
            }).then((saved) => {
              // "Set salary range" on the completeness card is answered by a floor that has
              // landed — not by the chip's tap that opened this sheet, and not by "No minimum".
              // `saved` is the server's copy, so a step already answered is never sent twice (§85).
              if (floor != null && saved?.nextSteps.some((step) => step.id === NEXT_STEP.salary)) {
                completeStep.mutate(NEXT_STEP.salary);
              }
            });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      );
    case 'sign-out':
      return (
        <ConfirmSheet
          open={open}
          title="Sign out?"
          message="You'll need to sign back in to keep tailoring resumes and tracking applications."
          art={<ConfirmArt kind="signOut" />}
          artGap={0}
          confirmLabel="Sign out"
          onConfirm={() => {
            // The order is load-bearing. Close the sheet and clear the caches while the tabs are
            // still mounted, then flip the session LAST: that flip fails the root layout's guard
            // and unmounts the (tabs) subtree this host lives in, so anything queued after it
            // would run against a torn-down tree.
            closeSheet();
            resetSession();
            signOut();
          }}
          onCancel={closeSheet}
        />
      );
    case 'delete-account':
      return (
        <ConfirmSheet
          open={open}
          title="Delete your account?"
          message="Your profile, resumes and applications are deleted for good."
          confirmLabel="Delete account"
          art={<Art art={PROFILE_DANGER_ART.deleteAccount} width={72 / 0.75} />}
          busy={deleteAccount.isPending}
          onConfirm={() =>
            // Only the server's yes ends the session — same close/clear/flip order as sign-out,
            // and for the same reason. In the 'error' mock mode the delete rejects, `onSuccess`
            // never runs, `isPending` clears and the sheet re-enables for the retry, with the
            // toast above it saying why nothing happened. That refusal used to be silent (§85).
            deleteAccount.mutate(undefined, {
              onSuccess: () => {
                closeSheet();
                resetSession();
                endAccount();
              },
              onError: () => showToast(DELETE_ACCOUNT_FAILED, 'error'),
            })
          }
          onCancel={closeSheet}
        />
      );
  }
}
