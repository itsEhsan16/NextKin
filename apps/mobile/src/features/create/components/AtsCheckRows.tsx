import type { ReactNode } from 'react';
import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import PasteIcon from '../../../../assets/icons/create/paste-jd.svg';
import type { Job } from '@/data/models';
import { EntryTile } from '@/features/profile/components/cards';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

// ATS 01 / 01b at 390 (645:22, 645:31, 645:37, 645:82, 645:91), in artboard units.
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 13 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const FILE_TILE = 40 / 0.75; // 645:19
const FILE_TILE_RADIUS = 11 / 0.75;
const PILL_H = 32 / 0.75; // 645:20
const PILL_PAD_X = 13 / 0.75;
const PILL_RADIUS = 10 / 0.75;
const PASTE_PAD_X = 16 / 0.75; // 645:37
const PASTE_PAD_Y = 18 / 0.75;
const PASTE_GAP = 14 / 0.75;
const PASTE_BORDER = 1.25 / 0.75;
const PASTE_ICON_W = 46 / 0.75; // 649:2
const PASTE_ICON_H = 45.8903 / 0.75;
const TIP_PAD_X = 12 / 0.75; // 645:82
const TIP_PAD_Y = 10 / 0.75;
const TIP_GAP = 10 / 0.75;
const TIP_RADIUS = 12 / 0.75;
const TIP_SPARKLE_W = 20 / 0.75;
const TIP_SPARKLE_H = 19.591 / 0.75;
const LINK_GAP = 7 / 0.75; // 645:92 → 645:93
const LINK_H = 17 / 0.75;

export type AtsFileState = 'reading' | 'ready' | 'unreadable' | 'failed';

/** The lavender "Change" / "Try another" pill on a row (645:20). */
function RowPill({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(label, hint)}
      feedback="scale"
      haptic="light"
      hitSlop={hitSlopFor(styles.pill.height)}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: colors.brandSurface }]}
    >
      <Text variant="captionSemiBold" color="brand">
        {label}
      </Text>
    </Pressable>
  );
}

/** The white card both picks sit on (645:22 / 645:31): leading tile, lines, then the pill. */
function PickRow({
  leading,
  children,
  trailing,
}: {
  leading: ReactNode;
  children: ReactNode;
  trailing: ReactNode;
}) {
  const { colors, radii, shadows, sizes } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.row,
        shadows.card,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.borderHairline,
          borderWidth: sizes.border,
          borderRadius: radii.cardLg,
        },
      ]}
    >
      {leading}
      <View style={styles.text}>{children}</View>
      {trailing}
    </View>
  );
}

/**
 * The resume being checked (645:22): its file, what we read of it, and Change. While it is read
 * the pill waits; a file with no text in it (a scan, a photo) says so and offers another.
 */
export function AtsFileRow({
  fileName,
  state,
  meta,
  onChange,
}: {
  fileName: string;
  state: AtsFileState;
  /** "Uploaded just now · 2 pages", once read. */
  meta?: string;
  onChange: () => void;
}) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const pdf = /\.pdf$/i.test(fileName);
  const line =
    state === 'reading'
      ? 'Reading your resume…'
      : state === 'unreadable'
        ? 'We couldn’t read this file. It may be a scan or a photo.'
        : state === 'failed'
          ? 'It didn’t upload. Check your connection and try again.'
          : meta;
  const refused = state === 'unreadable' || state === 'failed';

  return (
    <PickRow
      leading={
        <View style={[styles.fileTile, { backgroundColor: colors.dangerSurface }]}>
          <Icon name={pdf ? 'File04' : 'File06'} size="md" color={colors.glyphDanger} />
        </View>
      }
      trailing={
        state === 'reading' ? (
          <Spinner size={s(15 / 0.75)} />
        ) : (
          <RowPill
            label={refused ? 'Try another' : 'Change'}
            hint="Pick a different file from your phone"
            onPress={onChange}
          />
        )
      }
    >
      <Text variant="label" numberOfLines={1}>
        {fileName}
      </Text>
      {line ? (
        <Text
          variant="caption"
          color={refused ? 'danger' : 'textSecondary'}
          accessibilityLiveRegion={refused ? 'polite' : undefined}
        >
          {line}
        </Text>
      ) : null}
    </PickRow>
  );
}

/** "Against this job" (645:31): the saved job the resume is checked against, and Change. */
export function AtsJobRow({ job, onChange }: { job: Job; onChange: () => void }) {
  return (
    <PickRow
      leading={<EntryTile tile={{ kind: 'letter', name: job.company }} size="md" />}
      trailing={<RowPill label="Change" hint="Pick a different saved job" onPress={onChange} />}
    >
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        Against this job
      </Text>
      <Text variant="label" numberOfLines={1}>
        {job.title}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {`${job.company} · ${job.location}`}
      </Text>
    </PickRow>
  );
}

/** "Or paste a job description" (645:37): the dashed lavender way to a job not on NextKin. */
export function PasteJdTile({ onPress }: { onPress: () => void }) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Or paste a job description', 'For a job that isn’t on NextKin')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.paste,
        {
          borderRadius: radii.cardLg,
          backgroundColor: colors.surfaceNewDoc,
          borderColor: colors.borderBrandDashed,
        },
      ]}
    >
      <PasteIcon width={s(PASTE_ICON_W)} height={s(PASTE_ICON_H)} />
      <View style={styles.text}>
        <Text variant="pickCardTitle">Or paste a job description</Text>
        <Text variant="caption" color="textSecondary">
          For a job that isn’t on NextKin
        </Text>
      </View>
      <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
    </Pressable>
  );
}

/** The lavender tip under a pasted description (645:82): the sparkle, "Tip", one line. */
export function TipCard({ text }: { text: string }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View accessible style={[styles.tip, { backgroundColor: colors.brandSurface }]}>
      <SparkleIcon width={s(TIP_SPARKLE_W)} height={s(TIP_SPARKLE_H)} />
      <View style={styles.text}>
        <Text variant="captionSemiBold">Tip</Text>
        <Text variant="micro" color="textBody">
          {text}
        </Text>
      </View>
    </View>
  );
}

/** "Use a saved job instead" (645:91), back from a pasted description to the saved job. */
export function UseSavedJobLink({ onPress }: { onPress: () => void }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Use a saved job instead')}
      feedback="subtle"
      haptic="light"
      hitSlop={hitSlopFor(s(LINK_H))}
      onPress={onPress}
      style={styles.link}
    >
      <Icon name="Bookmark" size="sm" color={colors.brand} />
      <Text variant="captionSemiBold" color="brand">
        Use a saved job instead
      </Text>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  fileTile: {
    width: s(FILE_TILE),
    height: s(FILE_TILE),
    borderRadius: s(FILE_TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: s(PILL_H),
    paddingHorizontal: s(PILL_PAD_X),
    borderRadius: s(PILL_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PASTE_GAP),
    paddingHorizontal: s(PASTE_PAD_X),
    paddingVertical: s(PASTE_PAD_Y),
    borderWidth: s(PASTE_BORDER),
    borderStyle: 'dashed',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(TIP_GAP),
    paddingHorizontal: s(TIP_PAD_X),
    paddingVertical: s(TIP_PAD_Y),
    borderRadius: s(TIP_RADIUS),
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: s(LINK_GAP),
    minHeight: s(LINK_H),
  },
}));
