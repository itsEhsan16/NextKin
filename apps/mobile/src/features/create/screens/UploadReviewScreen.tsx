import { useMemo, useState, type ReactNode } from 'react';

import { useApplyProfileDraft } from '@/data/queries';
import { useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { ImportRowGroups } from '../components/ImportRowGroups';
import { useCreateActions } from '../hooks/useCreateActions';
import {
  NOTHING_ACCEPTED_NOTE,
  acceptedDraft,
  addedSummary,
  alsoFoundTitle,
  importGroups,
  initialAccepted,
  splitFacts,
} from '../importDraft';
import { useImportStore } from '../importStore';

const ADD_FAILED = "We couldn't add those to your profile. Nothing changed — try again.";

/**
 * CREATE — review what an upload parsed (V2 §7.4). The second half of the upload flow.
 *
 * §7.4 is emphatic: a parse yields a DRAFT, and nothing touches the profile until the reader
 * accepts rows. So every line carries its own switch, the rows the parser guessed at start OFF
 * behind a pill that says why, and "Skip" leaves the profile byte-for-byte unchanged. The
 * document is real either way — the parse already wrote it to the library — which is why both
 * exits open it rather than only the one that commits.
 *
 * There is no loading state, deliberately: the draft comes from `useImportStore`, which is
 * synchronous, so it is either here on the first frame or it is not here at all (the empty state
 * below). The only wait on this page is the commit itself, and that is the primary's spinner.
 *
 * Jobs and dates lead, because they are what a resume can't get wrong (toreview §145.2). Everything
 * else is one tap away, on and counted in the note, so reading it all isn't the price of moving on.
 *
 * No artboard covers this flow (plan §8), so it is built from the spec on existing primitives.
 */
export function UploadReviewScreen() {
  const { spacing } = useTheme();
  const actions = useCreateActions();

  const draft = useImportStore((state) => state.draft);
  const resumeId = useImportStore((state) => state.resumeId);
  const thenPickJob = useImportStore((state) => state.thenPickJob);
  const clearImport = useImportStore((state) => state.clearImport);
  const apply = useApplyProfileDraft();

  const groups = useMemo(() => importGroups(draft), [draft]);
  const { facts, others } = useMemo(() => splitFacts(groups), [groups]);
  const [showOthers, setShowOthers] = useState(false);
  // Seeded once from the draft that was in the store when the page opened: the store is only
  // written by the upload screen behind us, so nothing can move it under the reader's fingers.
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(() => initialAccepted(draft));

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Check what we found" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      footer={footer}
    >
      {children}
    </Screen>
  );

  // Opened cold — a deep link, or a draft already spent. Retrying nothing would do nothing, so
  // the way forward is the step that makes a draft in the first place.
  if (!draft || !resumeId) {
    return page(
      <StateView
        icon="UploadCloud02"
        title="Nothing to review"
        actionLabel="Upload a resume"
        onAction={actions.openUpload}
      />,
    );
  }

  // Both exits go the same way: the document, or on to the job for a first resume.
  const leave = () => {
    clearImport();
    if (thenPickJob) actions.openBuildFrom(resumeId);
    else actions.openDocument(resumeId);
  };

  // The parse produced a document but no rows worth showing. The document is still real, so this
  // is a dead end for the profile only — not for the upload.
  if (groups.length === 0) {
    return page(
      <StateView
        icon="File06"
        title="We couldn't find anything to add"
        // The action opens the DOCUMENT, not the profile, so the manual route has to be named:
        // without it this state is a profile dead end that offers no way to a profile at all.
        message="It’s saved in your library. Add roles and skills by hand instead."
        actionLabel="Open the document"
        onAction={leave}
      />,
    );
  }

  const toggle = (key: string, value: boolean) =>
    setAccepted((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });

  const selection = acceptedDraft(draft, accepted);
  const summary = addedSummary(selection);

  const add = () => {
    apply.mutate(selection, { onSuccess: leave });
  };

  return page(
    <>
      <Text variant="body" color="textSecondary">
        Nothing is added to your profile until you press Add.
      </Text>

      <ImportRowGroups groups={facts} accepted={accepted} onToggle={toggle} />
      {others.length > 0 ? (
        <Disclosure
          mode="row"
          title={alsoFoundTitle(others, accepted)}
          expanded={showOthers}
          onToggle={() => setShowOthers((shown) => !shown)}
        >
          <ImportRowGroups groups={others} accepted={accepted} onToggle={toggle} />
        </Disclosure>
      ) : null}
    </>,
    <StickyActionBar
      // What the press will do, said before it is made — or why it cannot be made yet.
      note={apply.isError ? ADD_FAILED : (summary ?? NOTHING_ACCEPTED_NOTE)}
      noteTone={apply.isError ? 'danger' : 'neutral'}
      secondary={{ label: 'Skip', onPress: leave }}
      primary={{
        label: 'Add to profile',
        loading: apply.isPending,
        disabled: summary === null,
        onPress: add,
      }}
    />,
  );
}
