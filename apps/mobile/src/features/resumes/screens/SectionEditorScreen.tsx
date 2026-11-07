import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { EDITABLE_SECTION_LABEL, type EditableSectionKey } from '@/data/models';
import {
  useResume,
  useResumeContent,
  useUpdateLetter,
  useUpdateResumeSection,
} from '@/data/queries';
import { useTheme } from '@/theme';
import { ConfirmArt, ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { SectionBody, SectionSkeleton } from '../components/sections';
import { useResumesStore } from '../resumesStore';
import {
  draftFor,
  draftsEqual,
  letterPatch,
  normalizeSection,
  validateSection,
  type SectionDraft,
} from '../sectionEdits';

export type SectionEditorScreenProps = { id: string; section?: EditableSectionKey };

/** V2 §7.6 forbids a silent failure; the reason goes on the bar that started the work. */
const SAVE_FAILED = "We couldn't save that. Check your connection and try again.";
const FIX_FIRST = 'Fix the highlighted fields to save.';
/** Header → first card on RESUMES 07 / 08 (577:8630), in artboard units. */
const HEADER_TO_CONTENT = 14 / 0.75;

const DISCARD =
  'Your edits to this section have not been saved. Going back now leaves the document as it was.';

/**
 * One section of a document, edited on its own page (V2 §7.11; §7.10 for a cover letter's body).
 * Drawn as RESUMES 07 (Experience, 577:8623) and RESUMES 08 (Summary, 577:8828); the other
 * sections wear the same cards.
 *
 * The draft lives here rather than in the body, because the pinned bar and the discard sheet are
 * the body's siblings and both read it: the bar needs `dirty` and `valid` to decide whether Save
 * is live, and the sheet needs `dirty` to decide whether back is a question or a pop.
 */
export function SectionEditorScreen({ id, section }: SectionEditorScreenProps) {
  const { spacing, s } = useTheme();
  const router = useRouter();
  const showToast = useResumesStore((state) => state.showToast);

  const resume = useResume(id);
  const content = useResumeContent(id);
  const saveSection = useUpdateResumeSection(id);
  const saveLetter = useUpdateLetter(id);

  const [draft, setDraft] = useState<SectionDraft | undefined>(undefined);
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [refused, setRefused] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loaded = content.data;
  const seed = loaded && section ? draftFor(loaded, section) : undefined;

  // Seeded by effect rather than by a `key` on the body, for the reason in the note above. The
  // stamp is the version the body came back at, so a refetch that changed nothing re-seeds
  // nothing and a half-typed edit survives it.
  const stamp = seed && loaded ? `${loaded.versionId}:${seed.section}` : undefined;
  const seeded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!stamp || !seed || seeded.current === stamp) return;
    seeded.current = stamp;
    setDraft(seed);
    setTouched({});
    setRefused(false);
  }, [seed, stamp]);

  const active = draft ?? seed;
  const check = active ? validateSection(active) : undefined;
  const allErrors = check && !check.ok ? check.errors : {};
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const dirty = draft != null && seed != null && !draftsEqual(draft, seed);
  const valid = check?.ok === true;
  const pending = saveSection.isPending || saveLetter.isPending;
  const failed = saveSection.isError || saveLetter.isError;

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(SAVE_FAILED);
  }, [failed]);

  /**
   * The one way off this page. Android's hardware back is not intercepted here: `BackHandler` is
   * owned by `Sheet` alone in this codebase, and the discard sheet already claims it while it is
   * open, so adding a second subscription on the screen would fight it for the same press. The
   * header chevron is the affordance that asks the question.
   */
  const requestBack = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else router.back();
  }, [dirty, router]);

  const onSaved = useCallback(() => {
    // A document that has never been scored has no score to move, so the toast must not claim one.
    showToast(resume.data?.atsScore != null ? 'Saved · score recalculated' : 'Saved', 'editor');
    router.back();
  }, [resume.data?.atsScore, router, showToast]);

  const submit = useCallback(() => {
    if (!draft) return;
    if (!validateSection(draft).ok) {
      setRefused(true);
      return;
    }
    if (draft.section === 'letter') {
      saveLetter.mutate(letterPatch(draft.value), { onSuccess: onSaved });
      return;
    }
    saveSection.mutate(normalizeSection(draft), { onSuccess: onSaved });
  }, [draft, onSaved, saveLetter, saveSection]);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader
            title={section ? EDITABLE_SECTION_LABEL[section] : 'Edit section'}
            onBack={requestBack}
          />
        }
        headerStyle={{ paddingBottom: s(HEADER_TO_CONTENT) }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* A sibling of the page, never a child of its scroller. */}
      <ConfirmSheet
        open={confirmOpen}
        title="Discard changes?"
        message={DISCARD}
        art={<ConfirmArt kind="discard" />}
        artGap={0}
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

  const notThisDocument = page(
    <StateView
      icon="File06"
      title="That section isn't part of this document"
      actionLabel="Back to the document"
      onAction={() => router.back()}
    />,
  );

  // A route param can name a section this document does not have, and a deep link can arrive
  // with no id at all — neither is an error, so neither gets the danger state.
  if (!section || id.length === 0) return notThisDocument;

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (content.isPending || resume.isPending) {
    return page(
      <SectionSkeleton section={section} />,
      <StickyActionBar primary={{ label: 'Save', disabled: true }} />,
    );
  }

  if (content.isError || resume.isError) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this section"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void content.refetch();
          void resume.refetch();
        }}
      />,
    );
  }

  if (!active) return notThisDocument;

  return page(
    <SectionBody
      draft={active}
      onChange={setDraft}
      errors={errors}
      onBlurField={(key) => setTouched((t) => ({ ...t, [key]: true }))}
    />,
    <StickyActionBar
      note={failed ? SAVE_FAILED : Object.keys(errors).length > 0 ? FIX_FIRST : undefined}
      primary={{
        label: 'Save',
        loading: pending,
        // A failure leaves the button live, so pressing it again is the retry.
        disabled: !dirty || !valid,
        onPress: submit,
      }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
