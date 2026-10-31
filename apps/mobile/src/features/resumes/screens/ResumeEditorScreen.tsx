import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { atsBandFor, atsQuickWins, RESUME_SECTION_ORDER } from '@/data/models';
import { useRegenerateSection, useResume, useResumeContent, useResumeScore } from '@/data/queries';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { EditorHero } from '../components/EditorHero';
import { LetterBody } from '../components/LetterBody';
import { ResumeEditorSkeleton } from '../components/ResumeEditorSkeleton';
import { ResumeSectionCard } from '../components/ResumeSectionCard';
import {
  documentIsEmpty,
  downloadBlocked,
  FREE_NOTE,
  gateReason,
  quickWinsNote,
} from '../editorSections';
import { useResumesActions } from '../hooks/useResumesActions';
// Relative, not through the feature barrel: the barrel exports this screen, so importing the
// hosts from it would close a cycle.
import { ResumeExportHost } from '../ResumeExportHost';
import { ResumeMenuHost } from '../ResumeMenuHost';

export type ResumeEditorScreenProps = { id: string };

const DOWNLOAD = 'Download';

// RESUMES 06 at 390 (577:6931), in artboard units.
const HEADER_TO_HERO = 16 / 0.75;
const CARD_GAP = 12 / 0.75;

/**
 * The document editor (V2 §7.11) — where every tap on a document lands: the library grid and
 * list, Home's resume rail, a finished generation, and the notification and activity deep links.
 * Drawn as RESUMES 06 (577:6931): a bare back/more row, the document hero, then one card per
 * section.
 *
 * §7.11 keeps a document as a structured model rather than a rendered file, so this page is the
 * model: one card per section, each opening its own editor, and nothing here re-formats or parses
 * the text. The score is a view *of* the document and lives one tap away on the meta strip.
 */
export function ResumeEditorScreen({ id }: ResumeEditorScreenProps) {
  const { spacing, s } = useTheme();
  const router = useRouter();
  const actions = useResumesActions();

  const resume = useResume(id);
  const doc = resume.data;

  /**
   * Both of the queries below are conditional, and both are DISABLED rather than allowed to fail
   * (the disabled-query move `TailorScreen` uses for `useJob`): a document that is still being
   * written has no body to read, and an unscored draft is normal rather than broken. A disabled
   * query stays `isPending` for ever, so each branch below tests the flag that enabled it and
   * never `isPending` on its own.
   */
  const isReady = doc?.status === 'ready';
  const content = useResumeContent(isReady ? id : '');
  const isScored = doc?.atsScore != null;
  const score = useResumeScore(isScored ? id : '');

  // Not optimistic by design (`useRegenerateSection`), so the section it is running over holds a
  // shimmer until the model's copy lands rather than showing a guess.
  const regenerate = useRegenerateSection(id);
  const regenerating = regenerate.isPending ? regenerate.variables : undefined;

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader
            title={doc?.title ?? 'Document'}
            showTitle={false}
            onBack={actions.goBack}
            trailing={
              doc ? (
                <IconButton
                  icon="DotsHorizontal"
                  label="More actions"
                  onPress={() => actions.openMenu(doc, 'editor')}
                />
              ) : undefined
            }
          />
        }
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        footer={footer}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: s(CARD_GAP) }}
      >
        {children}
      </Screen>

      {/* Siblings of the Screen, never children of its scroller: a pushed screen sits above the
          tabs layout, so each sheet is hosted here to cover the page rather than the content. */}
      <ResumeMenuHost surface="editor" />
      <ResumeExportHost surface="editor" />
    </View>
  );

  const loading = page(
    <ResumeEditorSkeleton />,
    // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
    // without one would grow a footer out of nothing the moment the queries land.
    <StickyActionBar primary={{ label: DOWNLOAD, icon: 'Download01', disabled: true }} />,
  );

  if (resume.isError) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this document"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void resume.refetch()}
      />,
    );
  }

  if (resume.isPending || !doc) return loading;

  if (!isReady) {
    return page(
      <StateView
        icon="Stars02"
        title="We're still writing this one"
        actionLabel="Back to your resumes"
        // `navigate`, not `goBack`. This screen is reachable from a notification deep link, and
        // `back()` on a cold start has no entry to pop — it would do nothing at all, which is the
        // silently inert control §7.11's states forbid. The label names a destination, so the
        // action has to reach that destination every time it is pressed.
        onAction={() => router.navigate('/(tabs)/resumes')}
      />,
    );
  }

  if (content.isPending || (isScored && score.isPending)) return loading;

  if (content.isError || !content.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this document"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void content.refetch()}
      />,
    );
  }

  const body = content.data;
  const isLetter = body.kind === 'cover_letter';

  // A document created and never written. Six empty cards would read as six broken ones, so the
  // page points at the one section everything else hangs off instead. No action bar here either:
  // there is nothing to download yet, and the state's own button is the way forward.
  if (documentIsEmpty(body)) {
    return page(
      <StateView
        icon="File06"
        title="Nothing here yet"
        actionLabel={isLetter ? 'Write the letter' : 'Add summary'}
        onAction={() => actions.openSection(id, isLetter ? 'letter' : 'summary')}
      />,
    );
  }

  // V2 §7.9 — the download gate. Read off the body AND the document: `res_zoho` flags an assumed
  // role in its body with nothing on the document, and a skill claim can only be flagged on the
  // document, so either half alone lets the library card and this page disagree.
  const blocked = downloadBlocked(doc, body);
  const total = score.data?.total;
  const note =
    score.data != null
      ? quickWinsNote(atsQuickWins(score.data).length, atsBandFor(score.data.total) === 'strong')
      : undefined;

  return page(
    <>
      <EditorHero
        resume={doc}
        content={body}
        note={note}
        onOpenScore={() => actions.openScore(doc)}
        onOpenRubric={() => actions.openScoreRubric(id)}
      />

      {body.kind === 'cover_letter' ? (
        <LetterBody content={body} onEdit={() => actions.openSection(id, 'letter')} />
      ) : (
        RESUME_SECTION_ORDER.map((section, index) => (
          <ResumeSectionCard
            key={section}
            content={body}
            section={section}
            index={index}
            regenerating={regenerating === section}
            onEdit={() => actions.openSection(id, section)}
            onRegenerate={() => regenerate.mutate(section)}
          />
        ))
      )}
    </>,
    <StickyActionBar
      // §13.3 normally; when the gate holds, the reason REPLACES that line — a disabled control
      // is never left to look broken.
      note={blocked ? gateReason(body) : FREE_NOTE}
      secondary={
        total != null
          ? { label: `Score ${total}`, onPress: () => actions.openScore(doc) }
          : undefined
      }
      primary={{
        label: DOWNLOAD,
        icon: 'Download01',
        disabled: blocked,
        onPress: () => actions.downloadResume(doc, 'editor'),
      }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
