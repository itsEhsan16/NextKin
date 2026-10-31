import { memo } from 'react';
import { View } from 'react-native';

import { INTERVIEW_GENERIC_LABEL, interviewMarkCounts, type InterviewSet } from '@/data/models';
// Deep import on purpose: the notifications barrel drags its screens in. The map is pure.
import { companyMark } from '@/features/notifications/components/companyMark';
import { a11yButton, formatRelativeTime, initialOf } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Pill';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { marksLine } from '../practiceRows';
import { MarkSummary } from './MarkSummary';
import { Icon } from '@/ui/Icon';

export type InterviewSetCardProps = {
  set: InterviewSet;
  /** True when a newer set exists for the same target, so this one is captioned as earlier. */
  superseded: boolean;
  onOpen: (set: InterviewSet) => void;
  onLongPress: (set: InterviewSet) => void;
};

// INTERVIEW 01 at 390 (577:965), in artboard units.
const PAD = 15 / 0.75;
const GAP = 10 / 0.75;
const HEADER_GAP = 12 / 0.75;
const TILE = 40 / 0.75;
const TILE_RADIUS = 11.667 / 0.75;
const LINE_GAP = 2 / 0.75;

/**
 * One practice set on `/interview` (INTERVIEW 01 577:965): the company's tile, the set's name,
 * its size and age, then the marks. A standalone set carries the §7.15 "generic" label as a pill
 * among them — the acceptance criterion is that it is *visibly* labelled. Long press opens the
 * delete confirm; there is no swipe, because the card is the only row shape here.
 */
export const InterviewSetCard = memo(function InterviewSetCard({
  set,
  superseded,
  onOpen,
  onLongPress,
}: InterviewSetCardProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const counts = interviewMarkCounts(set);
  const summary = marksLine(counts);
  const when = formatRelativeTime(set.createdAt);
  const generic = set.source === 'standalone';
  const mark = companyMark(set.company ?? '');

  return (
    <Pressable
      {...a11yButton(
        [set.title, generic ? 'generic set' : undefined, summary, when].filter(Boolean).join(', '),
        'Opens practice. Long press to delete.',
      )}
      feedback="scale"
      haptic="light"
      onPress={() => onOpen(set)}
      onLongPress={() => onLongPress(set)}
    >
      <Card radius="cardLg" shadow="jobCard" padding={s(PAD)} style={{ gap: s(GAP) }}>
        <View style={styles.header}>
          <View style={[styles.tile, { backgroundColor: colors[mark.bg] }]}>
            <Text variant="entryInitial" color={mark.fg}>
              {mark.glyph ?? initialOf(set.company ?? set.title)}
            </Text>
          </View>
          <View style={styles.text}>
            <Text variant="title" numberOfLines={2}>
              {set.title}
            </Text>
            <Text variant="caption" color="textBody" numberOfLines={1}>
              {`${counts.total} questions · ${when}${superseded ? ' · Earlier set' : ''}`}
            </Text>
          </View>
          <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
        </View>
        <MarkSummary
          counts={counts}
          extra={generic ? <Pill label={INTERVIEW_GENERIC_LABEL} /> : undefined}
        />
      </Card>
    </Pressable>
  );
});

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(LINE_GAP) },
}));
