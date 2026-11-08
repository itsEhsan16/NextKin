import { View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import type { LegalSection } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type LegalSectionsProps = {
  sections: readonly LegalSection[];
  /** Each card's top, relative to this list, so the contents card can scroll to it. */
  onSectionLayout?: (index: number, y: number) => void;
};

// One section card at 390 (LEGAL 01 577:8963), in artboard units.
const CARD_GAP = 14 / 0.75;
const CARD_INNER_GAP = 10 / 0.75;
const HEADING_GAP = 10 / 0.75;
const BADGE = 24 / 0.75;

/**
 * A document body stores its paragraph breaks as blank lines. Rendering the raw string would put
 * the whole section in one run-on block, so each paragraph becomes its own `Text` — pure, so the
 * split is testable on its own and the component stays presentation.
 */
export function legalParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The lavender number disc a section wears, in the contents and on its own card (577:8965). */
export function SectionNumber({ value }: { value: number }) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.badge, { borderRadius: radii.full, backgroundColor: colors.brandSurface }]}
    >
      <Text variant="microBadge" color="brand" align="center">
        {String(value)}
      </Text>
    </View>
  );
}

/**
 * The sections of a legal document (V2 §8.5), one numbered card each as LEGAL 01/02 draw them
 * (577:8963 … 580:115), always open.
 *
 * Deliberately NOT accordion rows, which is how the score rubric lists its five components. The
 * rubric is reference material a reader dips into for one answer; these are the terms a person is
 * agreeing to, and a document that hides its clauses behind a tap each is worse for the reader
 * than one that scrolls — nothing can be skim-read, and the reader cannot tell how much there is.
 * The contents card above is the shortcut instead: it scrolls, it never hides.
 */
export function LegalSections({ sections, onSectionLayout }: LegalSectionsProps) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.list}>
      {sections.map((section, index) => (
        <Animated.View
          key={section.id}
          onLayout={(event: LayoutChangeEvent) =>
            onSectionLayout?.(index, event.nativeEvent.layout.y)
          }
        >
          <ProfileCard style={[styles.card, { padding: spacing[5] }]}>
            <View style={styles.heading}>
              <SectionNumber value={index + 1} />
              <Text {...a11yHeader(section.heading)} variant="title" style={styles.fill}>
                {section.heading}
              </Text>
            </View>
            {legalParagraphs(section.body).map((paragraph, paragraphIndex) => (
              <Text
                key={`${section.id}_p${paragraphIndex}`}
                variant="prose"
                color="textBody"
                selectable
              >
                {paragraph}
              </Text>
            ))}
          </ProfileCard>
        </Animated.View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  list: { gap: s(CARD_GAP) },
  card: { gap: s(CARD_INNER_GAP) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(HEADING_GAP) },
  fill: { flex: 1 },
  badge: { width: s(BADGE), height: s(BADGE), alignItems: 'center', justifyContent: 'center' },
}));
