import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type ScrollViewInstance } from 'react-native';

import { SCORE_LABEL, type AtsCheckItem } from '@/data/models';
import { useApplyAtsFix, useResume, useResumeScore } from '@/data/queries';
import AtsCheckArt from '../../../../assets/icons/create/ats-check.svg';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { a11yHeader, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { fixRowIds, fixRows, mergeOrder, todoItems } from '../atsFixRows';
import { AiPill } from '../components/AiPill';
import { AtsFixCard } from '../components/AtsFixCard';
import { useResumesActions } from '../hooks/useResumesActions';

export type AtsFixScreenProps = { id: string; itemId?: string };

/** The one honest sentence about what pressing Apply does (V2 §7.8). */
const LEDE =
  "Each fix edits your document and re-scores it. Nothing is added that your profile doesn't back.";

/** A failure goes on the bar, never on the card: the card keeps its live button as the retry. */
const APPLY_FAILED = "That fix didn't go through. Check your connection and try it again.";

/**
 * Skeleton geometry, each block the composed height of what replaces it: the lede's two lines,
 * and a card of Card's 16pt padding + hairline over a title (24), a suggestion (22) and the
 * 52pt chip/button row, with the gaps between them.
 */
const LEDE_BLOCK = 44;
const CARD_BLOCK = 148;
/** How much of the page is left above a deep-linked card when it is scrolled into view. */
const REVEAL_LEAD = 24;

// RESUMES 09 at 390 (577:9464), in artboard units.
const HEADER_TO_HERO = 14 / 0.75;
const HERO_ART_W = 64 / 0.75;
const HERO_ART_H = 62.3637 / 0.75;
const ART_TO_TITLE = 14 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;
const HERO_TO_SECTION = 26 / 0.75;
const SECTION_TO_CARDS = 12 / 0.75;
const CARD_GAP = 12 / 0.75;
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;

/** The page's hero (577:9491): the ATS check drawing, the title and the one honest sentence. */
function FixHero() {
  const { s } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.hero}>
      <AtsCheckArt width={s(HERO_ART_W)} height={s(HERO_ART_H)} />
      <Text {...a11yHeader()} variant="headlineLg" align="center" style={styles.heroTitle}>
        Fix with AI
      </Text>
      <Text variant="captionRegular" color="textSecondary" align="center" style={styles.lede}>
        {LEDE}
      </Text>
    </View>
  );
}

/** "Quick wins" over the cards, with the document's name at the other end (577:9497). */
function QuickWinsHeading({ document }: { document: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <Text {...a11yHeader()} variant="title" style={styles.fill}>
        Quick wins
      </Text>
      <Text variant="micro" color="textSecondary" numberOfLines={1} style={styles.document}>
        {document}
      </Text>
    </View>
  );
}

/**
 * Fix with AI — the quick-win list (V2 §7.8), drawn as RESUMES 09 (577:9464): an AI mark in the
 * header, the hero, then one card per check under "Quick wins".
 *
 * The screen's whole difficulty is that a fix REMOVES its own row: applying one makes the check
 * pass, so it leaves `atsQuickWins` on the next score. `atsFixRows` merges the live quick wins
 * with a snapshot of what this session applied, so the card ticks where it stands instead of
 * vanishing at the moment it worked. Gaps — keywords the profile does not back — are listed too
 * and never carry an Apply: §7.8 forbids handing them over as text to paste in.
 */
export function AtsFixScreen({ id, itemId }: AtsFixScreenProps) {
  const { spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const actions = useResumesActions();

  const resume = useResume(id);
  // An unscored draft is normal, not a failure — `useResumeScore` MISSES for one — so the query
  // is gated on the metadata the way the editor gates its body read.
  const scored = resume.data?.atsScore != null;
  const score = useResumeScore(scored ? id : '');
  const { mutate: applyFix } = useApplyAtsFix(id);

  const [applied, setApplied] = useState<Record<string, AtsCheckItem>>({});
  const [applyingId, setApplyingId] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const queue = useRef<AtsCheckItem[]>([]);

  /**
   * The first-seen order, adjusted during render rather than from an effect — React's documented
   * "adjusting state when props change". `mergeOrder` hands back the very array it was given when
   * the score brought no new check, so this settles in one pass and a re-score that only flipped
   * a `passed` flag re-renders nothing extra.
   */
  const [seenOrder, setSeenOrder] = useState<readonly string[]>([]);
  const order = mergeOrder(seenOrder, fixRowIds(score.data));
  if (order !== seenOrder) setSeenOrder(order);

  const rows = fixRows({ score: score.data, applied, applyingId, order });
  const todo = todoItems(rows);

  const start = useCallback(
    (item: AtsCheckItem) => {
      if (applyingId != null) return;
      queue.current = queue.current.filter((entry) => entry.id !== item.id);
      setFailure(undefined);
      setApplyingId(item.id);
      setRun((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      applyFix(item.id, {
        onSuccess: () => {
          setApplied((prev) => ({ ...prev, [item.id]: item }));
          setApplyingId(undefined);
        },
        onError: () => {
          // The row goes back to 'todo' with its button live, so pressing it again IS the retry.
          queue.current = [];
          setApplyingId(undefined);
          setRun(null);
          setFailure(APPLY_FAILED);
        },
      });
    },
    [applyFix, applyingId],
  );

  // Every apply re-scores, so two cannot overlap. One effect decides who is next — rather than
  // the success callback calling itself — so a failure empties the queue without racing a start.
  useEffect(() => {
    if (!run || applyingId != null) return;
    const next = queue.current[0];
    if (!next) {
      setRun(null);
      return;
    }
    start(next);
  }, [applyingId, run, start]);

  const applyAll = () => {
    if (todo.length === 0) return;
    queue.current = [...todo];
    setRun({ done: 0, total: todo.length });
  };

  // The deep-linked check is scrolled to rather than reordered: the list's order is the score's,
  // and quietly moving one card to the top would misreport where the check sits.
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const revealed = useRef(false);
  const reveal = useCallback(
    (rowId: string, y: number) => {
      if (!itemId || rowId !== itemId || revealed.current) return;
      revealed.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - s(REVEAL_LEAD)), animated: !reduced });
    },
    [itemId, reduced, s],
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title="Fix with AI"
          showTitle={false}
          onBack={actions.goBack}
          trailing={<AiPill />}
        />
      }
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: s(CARD_GAP) }}
      footer={footer}
      scrollRef={scrollRef}
    >
      {children}
    </Screen>
  );

  if (resume.isPending || (scored && score.isPending)) {
    // The bar is pinned while loading for the reason Tailor pins one: it owns the bottom inset,
    // so a loading page without it would resize the viewport when the queries land.
    return page(
      <FixSkeleton />,
      <StickyActionBar primary={{ label: 'Apply all', disabled: true }} />,
    );
  }

  if (!resume.data || resume.isError || (scored && (score.isError || !score.data))) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load these fixes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void resume.refetch();
          void score.refetch();
        }}
      />,
    );
  }

  if (!scored) {
    return page(
      <StateView
        art="allDone"
        icon="CheckCircle"
        title="Nothing to fix yet"
        message={`This document has no ${SCORE_LABEL} yet.`}
        actionLabel="Back to the document"
        onAction={actions.goBack}
      />,
    );
  }

  if (rows.length === 0) {
    return page(
      <StateView
        art="allDone"
        icon="CheckCircle"
        title="Nothing left to fix"
        actionLabel="Back to the score"
        onAction={actions.goBack}
      />,
    );
  }

  const bar =
    todo.length > 0 ? (
      <StickyActionBar
        primary={{
          label: `Apply all ${todo.length}`,
          leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
          onPress: applyAll,
          loading: run != null,
          disabled: applyingId != null,
        }}
        note={failure ?? (run ? `Applying ${run.done} of ${run.total}…` : undefined)}
      />
    ) : (
      <StickyActionBar primary={{ label: 'Done', onPress: actions.goBack }} note={failure} />
    );

  return page(
    <>
      <FixHero />
      <View
        style={{
          marginTop: s(HERO_TO_SECTION - CARD_GAP),
          marginBottom: s(SECTION_TO_CARDS - CARD_GAP),
        }}
      >
        <QuickWinsHeading document={resume.data.title} />
      </View>
      {rows.map((row) => (
        <AtsFixCard key={row.item.id} row={row} onApply={start} onLayout={reveal} />
      ))}
    </>,
    bar,
  );
}

/** Blocks in the shape of the cards that replace them — never a spinner. */
function FixSkeleton() {
  const { spacing, s } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading fixes" style={{ gap: spacing[4] }}>
      <Skeleton width="90%" height={s(LEDE_BLOCK)} />
      <Skeleton height={s(CARD_BLOCK)} radius="card" />
      <Skeleton height={s(CARD_BLOCK)} radius="card" />
      <Skeleton height={s(CARD_BLOCK)} radius="card" />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  heroTitle: { marginTop: s(ART_TO_TITLE) },
  lede: { marginTop: s(TITLE_TO_LEDE) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  fill: { flex: 1 },
  document: { flexShrink: 1 },
}));
