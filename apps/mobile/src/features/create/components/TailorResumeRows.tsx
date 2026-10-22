import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import UploadIcon from '../../../../assets/icons/create/upload.svg';
import type { Resume } from '@/data/models';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';

import { tailorResumeMeta } from './tailorResumeMeta';

// TAILOR 01 / 01b / 01c at 390 (606:162, 606:197, 606:383, 608:662), in artboard units.
const ROW_RADIUS = 13 / 0.75;
const ROW_PAD_LEFT = 12 / 0.75;
const ROW_PAD_RIGHT = 14 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 1 / 0.75;
const THUMB_W = 32 / 0.75;
const THUMB_H = 40 / 0.75;
const THUMB_RADIUS = 5 / 0.75;
const CHECK_DISC = 22 / 0.75;
const CHECK_GLYPH = 10 / 0.75;
const FILE_TILE = 36 / 0.75;
const FILE_TILE_RADIUS = 9 / 0.75;
const FILE_GLYPH = 16 / 0.75;
const ERROR_GAP = 5 / 0.75;
const ERROR_GLYPH = 10 / 0.75;
const RETRY_H = 30 / 0.75;
const RETRY_PAD_X = 12 / 0.75;
const UPLOAD_RADIUS = 15 / 0.75;
const UPLOAD_PAD_Y = 12 / 0.75;
const UPLOAD_LINE_GAP = 2 / 0.75;
const UPLOAD_ICON_W = 36 / 0.75;
const UPLOAD_ICON_H = 37.3472 / 0.75;
const UPLOAD_CHEVRON = 9 / 0.75;
const LINK_PAD_LEFT = 12 / 0.75; // 606:390
const LINK_GAP = 6 / 0.75;
const LINK_GLYPH = 11 / 0.75;
const LINK_H = 16 / 0.75;
const SKELETON_TITLE_H = 14 / 0.75; // the 15/20 title's cap height, roughly
const SKELETON_META_H = 11 / 0.75;

/** The brand check disc a picked row ends on (606:166). */
export function CheckDisc() {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.checkDisc, { backgroundColor: colors.brand }]}>
      <FontAwesome5 name="check" size={s(CHECK_GLYPH)} color={colors.textOnBrand} solid />
    </View>
  );
}

/** The washed lavender of a picked row; every row keeps the hairline so picking does not grow it. */
export function useRowLook(selected: boolean) {
  const { colors, sizes } = useTheme();
  return {
    borderWidth: sizes.border,
    borderColor: selected ? colors.brandBorder : 'transparent',
    backgroundColor: selected ? colors.brandSurface : 'transparent',
  };
}

/** A resume on NextKin (606:162 picked / 606:177 not): thumbnail, title and freshness. */
export function ResumeOptionRow({
  resume,
  selected,
  onPress,
}: {
  resume: Resume;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  const look = useRowLook(selected);
  const meta = tailorResumeMeta(resume);

  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityLabel={`${resume.title}, ${meta}`}
      accessibilityState={{ selected }}
      feedback="subtle"
      haptic="selection"
      onPress={onPress}
      style={[styles.row, look]}
    >
      <View
        style={[styles.thumb, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}
      >
        <ResumeThumbnail style={styles.fill} />
      </View>
      <View style={styles.text}>
        <Text variant={selected ? 'label' : 'menuRow'} numberOfLines={1}>
          {resume.title}
        </Text>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {selected ? <CheckDisc /> : null}
    </Pressable>
  );
}

export type PhoneFileState = 'reading' | 'ready' | 'unreadable' | 'failed';

/** Red for a PDF, blue for Word — the export sheet's tiles (580:1622 / 580:1630). */
function fileLook(name: string): { icon: string; bg: ColorToken; fg: ColorToken } {
  return /\.docx?$/i.test(name)
    ? { icon: 'file-word', bg: 'tileInfo', fg: 'glyphInfo' }
    : { icon: 'file-pdf', bg: 'dangerSurface', fg: 'glyphDanger' };
}

/**
 * The file picked from the phone: reading it, read and picked (TAILOR 01b 606:383), or refused
 * (01c 608:662) with "Try another" in the row, so the NextKin resumes stay one tap away.
 */
export function PhoneFileRow({
  fileName,
  state,
  meta,
  selected,
  onPress,
  onRetry,
}: {
  fileName: string;
  state: PhoneFileState;
  /** "Uploaded just now · 2 pages", once the file is read. */
  meta?: string;
  selected: boolean;
  onPress: () => void;
  onRetry: () => void;
}) {
  const { colors, radii, sizes, s } = useTheme();
  const styles = useStyles();
  const pickedLook = useRowLook(selected && state === 'ready');
  const look = fileLook(fileName);
  const refused = state === 'unreadable' || state === 'failed';

  const tile = (
    <View
      style={[styles.fileTile, { backgroundColor: refused ? colors.surfaceCard : colors[look.bg] }]}
    >
      <FontAwesome5
        name={look.icon}
        size={s(FILE_GLYPH)}
        color={refused ? colors.iconMuted : colors[look.fg]}
        solid
      />
    </View>
  );

  if (refused) {
    const reason =
      state === 'unreadable' ? "We couldn't read this file" : "We couldn't upload this file";
    return (
      <View
        accessible={false}
        style={[
          styles.row,
          styles.refusedRow,
          {
            borderWidth: sizes.border,
            borderColor: colors.dangerBorder,
            backgroundColor: colors.dangerSurface,
          },
        ]}
      >
        {tile}
        <View style={styles.text}>
          <Text variant="menuRow" numberOfLines={1}>
            {fileName}
          </Text>
          <View style={[styles.errorLine, { gap: s(ERROR_GAP) }]}>
            <FontAwesome5
              name="exclamation-circle"
              size={s(ERROR_GLYPH)}
              color={colors.glyphDanger}
              solid
            />
            <Text
              variant="micro"
              color="danger"
              style={styles.fill}
              accessibilityLiveRegion="polite"
            >
              {reason}
            </Text>
          </View>
        </View>
        <Pressable
          {...a11yButton('Try another', 'Pick a different file from your phone')}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(RETRY_H))}
          onPress={onRetry}
          style={[
            styles.retry,
            {
              borderRadius: radii.full,
              borderWidth: sizes.border,
              borderColor: colors.borderDefault,
              backgroundColor: colors.surfaceCard,
            },
          ]}
        >
          <Text variant="microBadge">Try another</Text>
        </Pressable>
      </View>
    );
  }

  const reading = state === 'reading';
  const subtitle = reading ? 'Reading your file…' : (meta ?? '');
  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityLabel={`${fileName}, ${subtitle}`}
      accessibilityState={{ selected, busy: reading }}
      feedback="subtle"
      haptic="selection"
      // Not `disabled`: that dims the row, and a file being read is what the sheet is busy with.
      onPress={reading ? undefined : onPress}
      style={[styles.row, pickedLook]}
    >
      {tile}
      <View style={styles.text}>
        <Text variant={selected ? 'label' : 'menuRow'} numberOfLines={1}>
          {fileName}
        </Text>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {reading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Spinner size={s(15 / 0.75)} />
        </View>
      ) : selected ? (
        <CheckDisc />
      ) : null}
    </Pressable>
  );
}

/** "Upload a resume / PDF or DOCX from your phone" — the dashed lavender row (606:197). */
export function UploadPromptRow({ onPress }: { onPress: () => void }) {
  const { colors, sizes, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Upload a resume', 'PDF or DOCX from your phone')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.upload,
        {
          borderWidth: sizes.border,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceNewDoc,
        },
      ]}
    >
      <UploadIcon width={s(UPLOAD_ICON_W)} height={s(UPLOAD_ICON_H)} />
      <View style={[styles.text, { gap: s(UPLOAD_LINE_GAP) }]}>
        <Text variant="menuRow" numberOfLines={1}>
          Upload a resume
        </Text>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          PDF or DOCX from your phone
        </Text>
      </View>
      <FontAwesome5
        name="chevron-right"
        size={s(UPLOAD_CHEVRON)}
        color={colors.iconChevron}
        solid
      />
    </Pressable>
  );
}

/** "↑ Upload a different file" under a read file (606:390). */
export function UploadDifferentLink({ onPress }: { onPress: () => void }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Upload a different file')}
      feedback="subtle"
      haptic="light"
      hitSlop={hitSlopFor(s(LINK_H))}
      onPress={onPress}
      style={styles.link}
    >
      <FontAwesome5 name="upload" size={s(LINK_GLYPH)} color={colors.brand} solid />
      <Text variant="microBadge" color="brand">
        Upload a different file
      </Text>
    </Pressable>
  );
}

/** A NextKin row while the library loads: the thumbnail's box and two lines. */
export function ResumeRowSkeleton() {
  const { s } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton width={s(THUMB_W)} height={s(THUMB_H)} radius="xs" />
      <View style={styles.text}>
        <Skeleton width="55%" height={s(SKELETON_TITLE_H)} />
        <Skeleton width="80%" height={s(SKELETON_META_H)} />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    borderRadius: s(ROW_RADIUS),
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(ROW_PAD_Y),
  },
  // 608:662 pads both sides 12: the Try another pill needs the room.
  refusedRow: { paddingRight: s(ROW_PAD_LEFT) },
  text: { flex: 1, gap: s(LINE_GAP) },
  fill: { flex: 1 },
  thumb: {
    width: s(THUMB_W),
    height: s(THUMB_H),
    borderRadius: s(THUMB_RADIUS),
    overflow: 'hidden',
  },
  checkDisc: {
    width: s(CHECK_DISC),
    height: s(CHECK_DISC),
    borderRadius: s(CHECK_DISC) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTile: {
    width: s(FILE_TILE),
    height: s(FILE_TILE),
    borderRadius: s(FILE_TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorLine: { flexDirection: 'row', alignItems: 'center' },
  retry: {
    height: s(RETRY_H),
    paddingHorizontal: s(RETRY_PAD_X),
    alignItems: 'center',
    justifyContent: 'center',
  },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    borderRadius: s(UPLOAD_RADIUS),
    borderStyle: 'dashed',
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(UPLOAD_PAD_Y),
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: s(LINK_GAP),
    minHeight: s(LINK_H),
    paddingLeft: s(LINK_PAD_LEFT),
  },
}));
