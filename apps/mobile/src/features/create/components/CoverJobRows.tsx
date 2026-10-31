import { View } from 'react-native';

import type { Resume } from '@/data/models';
import { useJob } from '@/data/queries';
import { EntryTile } from '@/features/profile/components/cards';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { CheckDisc, useRowLook } from './TailorResumeRows';
import { Icon } from '@/ui/Icon';

// COVER 00 at 390 (613:1402 picked / 613:1411 not, 613:1423), in artboard units.
const ROW_RADIUS = 13 / 0.75;
const ROW_PAD_LEFT = 12 / 0.75;
const ROW_PAD_RIGHT = 14 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 1 / 0.75;
const LINK_PAD_LEFT = 12 / 0.75;
const LINK_GAP = 6 / 0.75;
const LINK_INNER_GAP = 4.5 / 0.75;
const LINK_H = 16 / 0.75;

/**
 * One job a letter can be written for (613:1402): the company's letter tile, "Senior Product
 * Designer · Stripe", and the tailored resume it would be written from. The job is read by id
 * from the resume's link; until it lands (or if it is gone) the row names the resume instead, so
 * it stays pickable.
 */
export function CoverJobRow({
  resume,
  selected,
  onPress,
}: {
  resume: Resume;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const look = useRowLook(selected);
  const job = useJob(resume.linkedJobId ?? '');

  const title = job.data ? `${job.data.title} · ${job.data.company}` : resume.title;
  const company = job.data?.company ?? resume.targetCompany ?? resume.title;
  const meta = `Resume: ${resume.title}`;

  return (
    <Pressable
      accessible
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${meta}`}
      accessibilityState={{ selected }}
      feedback="subtle"
      haptic="selection"
      onPress={onPress}
      style={[styles.row, look]}
    >
      <EntryTile tile={{ kind: 'letter', name: company }} size="sm" />
      <View style={styles.text}>
        <Text variant={selected ? 'label' : 'menuRow'} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {selected ? <CheckDisc /> : null}
    </Pressable>
  );
}

/** "Job not here? Tailor a resume for it first ›" (613:1423). */
export function TailorFirstLink({ onPress }: { onPress: () => void }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.linkRow}>
      <Text variant="micro" color="textSecondary">
        Job not here?
      </Text>
      <Pressable
        {...a11yButton('Tailor a resume for it first', 'Opens Jobs to pick the job')}
        feedback="subtle"
        haptic="light"
        hitSlop={hitSlopFor(s(LINK_H))}
        onPress={onPress}
        style={styles.link}
      >
        <Text variant="microBadge" color="brand">
          Tailor a resume for it first
        </Text>
        <Icon name="ChevronRight" size="sm" color={colors.brand} />
      </Pressable>
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
  text: { flex: 1, gap: s(LINE_GAP) },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: s(LINK_GAP),
    paddingLeft: s(LINK_PAD_LEFT),
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(LINK_INNER_GAP),
    minHeight: s(LINK_H),
  },
}));
