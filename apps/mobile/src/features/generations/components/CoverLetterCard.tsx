import { View } from 'react-native';

import type { CoverLetterContent } from '@/data/models';
import { EntryTile } from '@/features/profile/components/cards';
import { companyMark } from '@/features/notifications/components/companyMark';
import { initialOf } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type CoverLetterCardProps = {
  /** The letter's body; absent while it loads, which draws the excerpt's own skeleton. */
  letter?: CoverLetterContent;
  /** The job it was written for; without one the head names the resume instead. */
  job?: { title: string; company: string };
  resumeTitle?: string;
  onEdit: () => void;
};

// COVER 03's letter card at 390 (644:179), in artboard units.
const PAD_X = 15 / 0.75;
const PAD_Y = 13 / 0.75;
const HEAD_GAP = 12 / 0.75; // 644:180
const LINE_GAP = 2 / 0.75; // 644:183
const TILE = 36 / 0.75; // 644:181
const TILE_RADIUS = 10 / 0.75;
const HEAD_TO_EXCERPT = 12 / 0.75; // 644:186
const EXCERPT_PAD_X = 13 / 0.75; // 644:187
const EXCERPT_PAD_Y = 12 / 0.75;
const EXCERPT_GAP = 6 / 0.75;
const EXCERPT_RADIUS = 13 / 0.75;
/** The board shows five lines of the opening paragraph, then an ellipsis (644:189). */
const EXCERPT_LINES = 5;
/** The excerpt's height on the board, kept while the letter loads so nothing jumps. */
const EXCERPT_H = 143 / 0.75;
const BAR_H = 9 / 0.75;
const SKELETON_LINES = ['55%', '100%', '92%', '100%', '70%'] as const;
const EXCERPT_TO_EDIT = 12 / 0.75; // 644:190
const EDIT_H = 44 / 0.75; // 644:191
const EDIT_RADIUS = 13.5 / 0.75;

/**
 * The finished letter as COVER 03 shows it (644:179): the company's tile, "Cover letter for
 * Stripe" over the role, the opening of the letter on a grey panel, and Edit letter, which opens
 * the whole letter in the editor. The excerpt is a preview, not the document — the editor and the
 * PDF carry every paragraph and the sign-off.
 */
export function CoverLetterCard({ letter, job, resumeTitle, onEdit }: CoverLetterCardProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const opening = letter?.paragraphs[0];
  const mark = job ? companyMark(job.company) : undefined;

  return (
    <Card radius="cardLg" style={styles.card}>
      <View style={styles.head}>
        {job && mark ? (
          <View
            accessibilityRole="image"
            accessibilityLabel={`${job.company} logo`}
            style={[styles.tile, { backgroundColor: colors[mark.bg] }]}
          >
            <Text variant="entryInitial" color={mark.fg}>
              {mark.glyph ?? initialOf(job.company)}
            </Text>
          </View>
        ) : (
          <EntryTile tile={{ kind: 'glyph', icon: 'file-alt' }} size="sm" />
        )}
        <View style={styles.headText}>
          <Text variant="title" numberOfLines={1}>
            {job ? `Cover letter for ${job.company}` : 'Your cover letter'}
          </Text>
          {job || resumeTitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {job ? job.title : resumeTitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.excerpt,
          { backgroundColor: colors.surfaceSubtle },
          letter ? null : { minHeight: s(EXCERPT_H) },
        ]}
      >
        {letter ? (
          <>
            <Text variant="captionRegular" color="textBody">
              {letter.greeting}
            </Text>
            {opening ? (
              <Text variant="captionRegular" color="textBody" numberOfLines={EXCERPT_LINES}>
                {opening}
              </Text>
            ) : null}
          </>
        ) : (
          <View accessible accessibilityLabel="Loading the letter" style={styles.lines}>
            {SKELETON_LINES.map((width, index) => (
              <Skeleton key={index} width={width} height={s(BAR_H)} />
            ))}
          </View>
        )}
      </View>

      <Button
        label="Edit letter"
        variant="ghost"
        block
        disabled={!letter}
        onPress={onEdit}
        style={styles.edit}
      />
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { paddingHorizontal: s(PAD_X), paddingVertical: s(PAD_Y) },
  head: { flexDirection: 'row', alignItems: 'center', gap: s(HEAD_GAP) },
  headText: { flex: 1, gap: s(LINE_GAP) },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  excerpt: {
    marginTop: s(HEAD_TO_EXCERPT),
    paddingHorizontal: s(EXCERPT_PAD_X),
    paddingVertical: s(EXCERPT_PAD_Y),
    gap: s(EXCERPT_GAP),
    borderRadius: s(EXCERPT_RADIUS),
  },
  lines: { gap: s(EXCERPT_GAP) },
  edit: { marginTop: s(EXCERPT_TO_EDIT), height: s(EDIT_H), borderRadius: s(EDIT_RADIUS) },
}));
