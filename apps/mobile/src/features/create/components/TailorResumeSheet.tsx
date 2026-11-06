import { useState, type JSX, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import type { Job, Resume } from '@/data/models';
import { isUnreadableFileError, useImportResume, useResumes } from '@/data/queries';
import { pickDocument, useReducedMotion, type PickedDocument } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';

import {
  PhoneFileRow,
  ResumeOptionRow,
  ResumeRowSkeleton,
  UploadDifferentLink,
  UploadPromptRow,
} from './TailorResumeRows';
import { defaultTailorPick, tailorableResumes, uploadedMeta } from './tailorResumeMeta';
import { ZeroStartChoice } from './ZeroStartChoice';

export type TailorResumeSheetProps = {
  open: boolean;
  /** What the resume is for: a listing, or a job description the user brought (no company). */
  job: { title: Job['title']; company?: string };
  /** Pre-picks this resume; otherwise the base resume (isBase) is picked, else the first. */
  selectedResumeId?: string;
  onClose: () => void;
  /** The CTA: the picked NextKin resume's id, or the id of the resume the upload created. */
  onCompare: (resumeId: string) => void;
  /** ZERO 00b's second way in when the library is empty: Zero Resume for this job. */
  onStartFromNothing?: () => void;
};

// TAILOR 01 at 390 (606:142), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const HEADER_TO_GROUP = 14 / 0.75; // 606:150 + 606:151
const OVERLINE_TO_ROWS = 8 / 0.75;
const ROW_GAP = 4 / 0.75;
const GROUP_GAP = 16 / 0.75; // 606:194
const LINK_TO_GROUP = 18 / 0.75; // 01b 606:393
const FILE_TO_NOTE = 8 / 0.75; // 01b 606:389 / 01c 608:672
const HELPER_PAD_X = 12 / 0.75; // 01c 608:673
const GROUPS_TO_CTA = 22 / 0.75;
const CTA_HEIGHT = 48 / 0.75;
const CTA_RADIUS = 13.5 / 0.75;
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;
const SHEET_FLOOR = 451.5 / 0.75; // the shortest of the three boards (01b 606:369)
/** The list scrolls past this share of the window, keeping the title and the CTA on screen. */
const LIST_MAX_SHARE = 0.5;
const SKELETON_ROWS = 3;

const TITLE = 'Which resume should we tailor?';

type Upload =
  | { file: PickedDocument; status: 'reading' | 'unreadable' | 'failed' }
  | { file: PickedDocument; status: 'ready'; resume: Resume };

/** What the reader picked; null until they touch the list, so the default can follow the data. */
type Pick = { kind: 'resume'; id: string } | { kind: 'upload' } | null;

type BodyProps = Omit<TailorResumeSheetProps, 'open'>;

/**
 * TAILOR 01 / 01b / 01c (606:2, 606:229, 608:510) — the sheet's content, separate from the Sheet
 * so tests can drive it without gestures or animation (the OptionSheetBody split).
 *
 * An upload moves the phone group to the top and picks the file; a file that cannot be read stays
 * in the sheet with "Try another" rather than going to an error screen (toreview §56.2), and the
 * CTA stays off until something readable is picked.
 */
export function TailorResumeSheetBody({
  job,
  selectedResumeId,
  onClose,
  onCompare,
  onStartFromNothing,
}: BodyProps) {
  const { motion, spacing, s } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const resumes = useResumes();
  const importResume = useImportResume();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [pick, setPick] = useState<Pick>(null);

  const uploadedId = upload?.status === 'ready' ? upload.resume.id : undefined;
  const offered = resumes.data ? tailorableResumes(resumes.data, uploadedId) : [];
  const defaultId = defaultTailorPick(offered, selectedResumeId);
  const pickedResumeId = pick?.kind === 'resume' ? pick.id : pick == null ? defaultId : undefined;
  const compareId = pick?.kind === 'upload' ? uploadedId : pickedResumeId;

  const chooseFile = async () => {
    const file = await pickDocument(['pdf', 'docx']);
    if (!file) return;
    setUpload({ file, status: 'reading' });
    setPick({ kind: 'upload' });
    try {
      const { resume } = await importResume.mutateAsync(file);
      setUpload({ file, status: 'ready', resume });
    } catch (error) {
      setUpload({ file, status: isUnreadableFileError(error) ? 'unreadable' : 'failed' });
    }
  };

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * motion.stagger.row).duration(
          motion.durations.base,
        );
  const layout = layoutTransition(reduced);

  const overline = (label: string) => (
    <Text variant="overline" color="textSecondary" accessibilityRole="header">
      {label}
    </Text>
  );

  let nextKinRows: ReactNode = null;
  if (resumes.isPending) {
    nextKinRows = Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <ResumeRowSkeleton key={index} />
    ));
  } else if (resumes.isError) {
    nextKinRows = (
      <StateView
        compact
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your resumes"
        message="You can still upload one from your phone."
        actionLabel="Try again"
        onAction={() => void resumes.refetch()}
      />
    );
  } else if (offered.length > 0) {
    nextKinRows = offered.map((resume, index) => (
      <Animated.View key={resume.id} entering={enter(index)}>
        <ResumeOptionRow
          resume={resume}
          selected={resume.id === pickedResumeId}
          onPress={() => setPick({ kind: 'resume', id: resume.id })}
        />
      </Animated.View>
    ));
  }

  // §56.3: with nothing on NextKin the sheet is the upload row alone.
  const nextKinGroup =
    nextKinRows == null ? null : (
      <Animated.View key="nextkin" layout={layout} style={{ gap: s(OVERLINE_TO_ROWS) }}>
        {overline('ON NEXTKIN')}
        <View accessibilityRole="radiogroup" style={{ gap: s(ROW_GAP) }}>
          {nextKinRows}
        </View>
      </Animated.View>
    );

  const refused = upload?.status === 'unreadable' || upload?.status === 'failed';
  const phoneGroup = (
    <Animated.View key="phone" layout={layout} style={{ gap: s(OVERLINE_TO_ROWS) }}>
      {overline('FROM YOUR PHONE')}
      {upload ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.durations.base)}>
          <PhoneFileRow
            fileName={upload.file.name}
            state={upload.status}
            meta={upload.status === 'ready' ? uploadedMeta(upload.resume) : undefined}
            selected={pick?.kind === 'upload'}
            onPress={() => setPick({ kind: 'upload' })}
            onRetry={() => void chooseFile()}
          />
          {upload.status === 'ready' ? (
            <View style={{ marginTop: s(FILE_TO_NOTE) }}>
              <UploadDifferentLink onPress={() => void chooseFile()} />
            </View>
          ) : refused ? (
            <Text
              variant="micro"
              color="textSecondary"
              style={{ marginTop: s(FILE_TO_NOTE), paddingHorizontal: s(HELPER_PAD_X) }}
            >
              {upload.status === 'unreadable'
                ? 'It may be a scan. Use a text PDF or DOCX, or pick a resume below.'
                : 'Check your connection and try again, or pick a resume below.'}
            </Text>
          ) : null}
        </Animated.View>
      ) : (
        <UploadPromptRow onPress={() => void chooseFile()} />
      )}
    </Animated.View>
  );

  // ZERO 00b: nothing on NextKin and nothing picked yet — upload, or start from nothing. Once a
  // file is chosen the sheet becomes TAILOR 01b around it.
  if (onStartFromNothing && resumes.data && offered.length === 0 && !upload) {
    return (
      <View
        style={{ paddingHorizontal: spacing.gutter, paddingTop: s(TOP), paddingBottom: s(BOTTOM) }}
      >
        <ZeroStartChoice
          company={job.company ?? job.title}
          onUpload={() => void chooseFile()}
          onStartFromNothing={onStartFromNothing}
          onClose={onClose}
        />
      </View>
    );
  }

  // 01b/01c: once a file is in play its group leads, and the library follows.
  const groups = upload ? [phoneGroup, nextKinGroup] : [nextKinGroup, phoneGroup];
  const firstGap = upload?.status === 'ready' ? LINK_TO_GROUP : GROUP_GAP;

  return (
    <View
      style={{
        paddingHorizontal: spacing.gutter,
        paddingTop: s(TOP),
        paddingBottom: s(BOTTOM),
      }}
    >
      <OptionSheetHeader
        variant="card"
        title={TITLE}
        subtitle={job.company ? `For ${job.title} at ${job.company}` : `For ${job.title}`}
        onClose={onClose}
      />

      <ScrollView
        style={{ flexGrow: 0, maxHeight: windowHeight * LIST_MAX_SHARE }}
        contentContainerStyle={{ paddingTop: s(HEADER_TO_GROUP), gap: s(firstGap) }}
        showsVerticalScrollIndicator={false}
      >
        {groups}
      </ScrollView>

      <Button
        label="Compare with this job"
        leading={<SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />}
        block
        disabled={compareId == null}
        onPress={() => {
          if (compareId) onCompare(compareId);
        }}
        style={{ marginTop: s(GROUPS_TO_CTA), height: s(CTA_HEIGHT), borderRadius: s(CTA_RADIUS) }}
      />
    </View>
  );
}

/** "Which resume should we tailor?" — the first step of the job-first Tailor flow (toreview §56). */
export function TailorResumeSheet({ open, ...body }: TailorResumeSheetProps): JSX.Element {
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
      <TailorResumeSheetBody {...body} />
    </Sheet>
  );
}
