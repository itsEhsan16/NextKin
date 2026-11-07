import { View } from 'react-native';

import type { LegalSection } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { SectionNumber } from './LegalSections';
import { Icon } from '@/ui/Icon';

export type LegalContentsProps = {
  sections: readonly LegalSection[];
  onJump: (index: number) => void;
};

// The contents card at 390 (LEGAL 01 577:8911), in artboard units.
const CARD_PAD_TOP = 13 / 0.75;
const CARD_PAD_BOTTOM = 5 / 0.75;
const PAD_X = 15 / 0.75;
const HEADER_PAD_BOTTOM = 5 / 0.75;
const HEADER_GAP = 8 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
/** A one-line row: the 24pt disc and 10 above and below it. */
const ROW_MIN = 44 / 0.75;
/** Dividers start under the titles, past the disc (577:8920). */
const DIVIDER_START = 51 / 0.75;

const sectionsLabel = (count: number) => `${count} ${count === 1 ? 'section' : 'sections'}`;

/**
 * The document's table of contents (577:8911 / 580:31): a numbered row per section, each one a
 * shortcut that scrolls the page to that section's card.
 */
export function LegalContents({ sections, onJump }: LegalContentsProps) {
  const { colors, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={styles.card}>
      <View style={styles.header}>
        <Text {...a11yHeader()} variant="title" style={styles.fill}>
          Contents
        </Text>
        <Text variant="micro" color="textSecondary">
          {sectionsLabel(sections.length)}
        </Text>
      </View>

      {sections.map((section, index) => (
        <View key={section.id}>
          {index > 0 ? (
            <View
              style={[styles.divider, { height: sizes.border, backgroundColor: colors.divider }]}
            />
          ) : null}
          <Pressable
            {...a11yButton(`${index + 1}. ${section.heading}`, 'Scrolls to this section')}
            feedback="subtle"
            hitSlop={hitSlopFor(s(ROW_MIN))}
            onPress={() => onJump(index)}
            style={styles.row}
          >
            <SectionNumber value={index + 1} />
            <Text variant="menuRow" style={styles.fill}>
              {section.heading}
            </Text>
            <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
          </Pressable>
        </View>
      ))}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { paddingTop: s(CARD_PAD_TOP), paddingBottom: s(CARD_PAD_BOTTOM) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(HEADER_GAP),
    paddingHorizontal: s(PAD_X),
    paddingBottom: s(HEADER_PAD_BOTTOM),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  divider: { marginLeft: s(DIVIDER_START), marginRight: s(PAD_X) },
  fill: { flex: 1 },
}));
