import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FAQ_TOPIC_LABEL, FAQ_TOPIC_ORDER, type FaqItem } from '@/data/models';
import { ProfileCard, SectionHeading } from '@/features/profile/components/cards';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';

import { faqAnswersLabel } from '../faqSearch';
import { FaqRow } from './FaqRow';

export type FaqListProps = {
  items: readonly FaqItem[];
  /** The one open row, or nothing. See `HelpScreen` for why it is one and not many. */
  openId?: string;
  onToggle: (id: string) => void;
};

// SUPPORT 01 at 390 (577:6177 … 577:6261), in artboard units.
const HEADING_TO_CARD = 8 / 0.75;
/** A topic's card → the next topic's heading (577:6199). */
const GROUP_GAP = 16 / 0.75;
/** The card's own top and bottom inset around its rows (577:6182). */
const CARD_PAD_Y = 2 / 0.75;
/** Dividers stop this short of either edge (577:6189). */
const DIVIDER_INSET = 15 / 0.75;

/**
 * The FAQ itself, as SUPPORT 01 draws it: one titled group per topic, in the published topic
 * order, each with its count and a card of rows. A topic the search emptied is left out rather
 * than drawn as an empty card.
 */
export function FaqList({ items, openId, onToggle }: FaqListProps) {
  const { colors, motion, sizes } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const groups = FAQ_TOPIC_ORDER.map((topic) => ({
    topic,
    rows: items.filter((item) => item.topic === topic),
  })).filter((group) => group.rows.length > 0);

  return (
    <View style={styles.groups}>
      {groups.map((group, index) => (
        <Animated.View
          key={group.topic}
          entering={
            reduced
              ? undefined
              : FadeInDown.delay(
                  Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                ).duration(motion.durations.base)
          }
          style={styles.group}
        >
          <SectionHeading
            title={FAQ_TOPIC_LABEL[group.topic]}
            note={faqAnswersLabel(group.rows.length)}
          />
          <ProfileCard style={styles.card}>
            {group.rows.map((item, row) => (
              <View key={item.id}>
                {row > 0 ? (
                  <View
                    style={[
                      styles.divider,
                      { height: sizes.border, backgroundColor: colors.divider },
                    ]}
                  />
                ) : null}
                <FaqRow
                  item={item}
                  expanded={openId === item.id}
                  onToggle={() => onToggle(item.id)}
                />
              </View>
            ))}
          </ProfileCard>
        </Animated.View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  groups: { gap: s(GROUP_GAP) },
  group: { gap: s(HEADING_TO_CARD) },
  card: { paddingVertical: s(CARD_PAD_Y) },
  divider: { marginHorizontal: s(DIVIDER_INSET) },
}));
