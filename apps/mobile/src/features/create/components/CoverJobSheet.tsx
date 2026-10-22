import { useRouter } from 'expo-router';
import { useMemo, useState, type JSX, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useResumes } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';
import { StateView } from '@/ui/StateView';

import { coverLetterSources, pickCoverLetterSource } from '../coverLetterSetup';
import { CoverJobRow, TailorFirstLink } from './CoverJobRows';
import { ResumeRowSkeleton } from './TailorResumeRows';

export type CoverJobSheetProps = {
  open: boolean;
  /** Pre-picks this resume when it qualifies; otherwise the first one listed. */
  selectedResumeId?: string;
  onClose: () => void;
  /** The tailored resume behind the picked job. */
  onContinue: (resumeId: string) => void;
  /**
   * "Tailor a resume for it first". Defaults to closing the sheet and opening the Jobs tab; a
   * host whose close also leaves the page (COVER 01 with nothing picked) passes its own.
   */
  onTailorFirst?: () => void;
};

// COVER 00 at 390 (613:1390), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const HEADER_TO_ROWS = 14 / 0.75; // 613:1398 + 613:1399
const ROW_GAP = 4 / 0.75; // 613:1408
const ROWS_TO_LINK = 12 / 0.75; // 613:1422
const LINK_TO_CTA = 20 / 0.75; // 613:1428
const CTA_HEIGHT = 48 / 0.75; // 613:1429
const CTA_RADIUS = 13.5 / 0.75;
const SHEET_FLOOR = 385.5 / 0.75;
/** The list scrolls past this share of the window, keeping the title and the CTA on screen. */
const LIST_MAX_SHARE = 0.45;
const SKELETON_ROWS = 3;

const TITLE = 'Which job is the letter for?';
const SUBTITLE = 'We write it from the resume you tailored for that job.';

type BodyProps = Omit<CoverJobSheetProps, 'open'>;

/**
 * COVER 00 (613:1079) — the sheet's content, separate from the Sheet so tests can drive it
 * without gestures or animation (the OptionSheetBody split).
 *
 * §7.10 writes a letter from a resume tailored for the job, so the rows are exactly those
 * resumes, each named by its job. A job with no tailored resume is not listed: "Tailor a resume
 * for it first" sends the reader to Jobs, where that flow starts (toreview §57.2).
 */
export function CoverJobSheetBody({
  selectedResumeId,
  onClose,
  onContinue,
  onTailorFirst,
}: BodyProps) {
  const { motion, spacing, s } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const router = useRouter();
  const resumes = useResumes();
  const [pick, setPick] = useState<string | null>(null);

  const sources = useMemo(() => coverLetterSources(resumes.data ?? []), [resumes.data]);
  const pickedId =
    (pick != null && sources.some((resume) => resume.id === pick) ? pick : undefined) ??
    pickCoverLetterSource(sources, selectedResumeId)?.id;

  const tailorFirst =
    onTailorFirst ??
    (() => {
      onClose();
      router.navigate('/(tabs)/jobs');
    });

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * motion.stagger.row).duration(
          motion.durations.base,
        );

  let rows: ReactNode;
  if (resumes.isPending) {
    rows = Array.from({ length: SKELETON_ROWS }, (_, index) => <ResumeRowSkeleton key={index} />);
  } else if (resumes.isError) {
    rows = (
      <StateView
        compact
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your resumes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void resumes.refetch()}
      />
    );
  } else if (sources.length === 0) {
    rows = (
      <StateView
        compact
        icon="magic"
        title="No tailored resumes yet"
        message="A letter is written from a resume you tailored for the job. Tailor one first."
      />
    );
  } else {
    rows = sources.map((resume, index) => (
      <Animated.View key={resume.id} entering={enter(index)}>
        <CoverJobRow
          resume={resume}
          selected={resume.id === pickedId}
          onPress={() => setPick(resume.id)}
        />
      </Animated.View>
    ));
  }

  return (
    <View
      style={{
        paddingHorizontal: spacing.gutter,
        paddingTop: s(TOP),
        paddingBottom: s(BOTTOM),
      }}
    >
      <OptionSheetHeader variant="card" title={TITLE} subtitle={SUBTITLE} onClose={onClose} />

      <ScrollView
        style={{ flexGrow: 0, maxHeight: windowHeight * LIST_MAX_SHARE }}
        contentContainerStyle={{ paddingTop: s(HEADER_TO_ROWS) }}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="radiogroup" style={{ gap: s(ROW_GAP) }}>
          {rows}
        </View>
      </ScrollView>

      <View style={{ marginTop: s(ROWS_TO_LINK) }}>
        <TailorFirstLink onPress={tailorFirst} />
      </View>

      <Button
        label="Continue"
        block
        disabled={pickedId == null}
        onPress={() => {
          if (pickedId) onContinue(pickedId);
        }}
        style={{ marginTop: s(LINK_TO_CTA), height: s(CTA_HEIGHT), borderRadius: s(CTA_RADIUS) }}
      />
    </View>
  );
}

/** "Which job is the letter for?" — the first step of the cover-letter flow (toreview §57). */
export function CoverJobSheet({ open, ...body }: CoverJobSheetProps): JSX.Element {
  const { s } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={s(SHEET_FLOOR)}
      // The list scrolls once it is long; a dismiss pan would fight it for the gesture. The ✕,
      // the scrim and Android back all still close the sheet.
      swipeToDismiss={false}
      accessibilityLabel={TITLE}
    >
      <CoverJobSheetBody {...body} />
    </Sheet>
  );
}
