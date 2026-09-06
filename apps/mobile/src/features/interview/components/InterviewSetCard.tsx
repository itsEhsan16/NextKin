import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { INTERVIEW_GENERIC_LABEL, interviewMarkCounts, type InterviewSet } from '@/data/models';
import { a11yButton, formatRelativeTime } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { marksLine } from '../practiceRows';

export type InterviewSetCardProps = {
  set: InterviewSet;
  /** True when a newer set exists for the same target, so this one is captioned as earlier. */
  superseded: boolean;
  onOpen: (set: InterviewSet) => void;
  onLongPress: (set: InterviewSet) => void;
};

const CHEVRON = 11;
const BAR_HEIGHT = 4;

/**
 * One practice set on `/interview`. A standalone set carries the §7.15 "generic" label as a
 * chip, not a footnote — the acceptance criterion is that it is *visibly* labelled. Long press
 * opens the delete confirm; there is no swipe, because the card is the only row shape here.
 */
export const InterviewSetCard = memo(function InterviewSetCard({
  set,
  superseded,
  onOpen,
  onLongPress,
}: InterviewSetCardProps) {
  const { colors, spacing, s } = useTheme();
  const counts = interviewMarkCounts(set);
  const summary = marksLine(counts);
  const when = formatRelativeTime(set.createdAt);
  const generic = set.source === 'standalone';

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
      <Card radius="card" style={{ gap: spacing[3] }}>
        <View style={[styles.titleRow, { gap: spacing[3] }]}>
          <View style={styles.titleText}>
            <Text variant="title" numberOfLines={2}>
              {set.title}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[1] }}>
              {`${counts.total} questions · ${when}${superseded ? ' · Earlier set' : ''}`}
            </Text>
          </View>
          <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
        </View>

        {generic ? (
          <View style={styles.chipRow}>
            <Chip label={INTERVIEW_GENERIC_LABEL} tone="neutral" />
          </View>
        ) : null}

        <View style={{ gap: spacing[2] }}>
          <Text variant="captionSm" color="textSecondary">
            {summary}
          </Text>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ProgressBar
              value={counts.total > 0 ? counts.marked / counts.total : 0}
              height={s(BAR_HEIGHT)}
              trackColor="progressTrack"
              fillColor="success"
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleText: { flex: 1 },
  chipRow: { flexDirection: 'row' },
});
