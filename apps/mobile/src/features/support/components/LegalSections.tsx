import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { LegalSection } from '@/data/models';
import { a11yHeader, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type LegalSectionsProps = { sections: readonly LegalSection[] };

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

/**
 * The sections of a legal document (V2 §8.5), always open.
 *
 * Deliberately NOT `Disclosure` rows, which is how the score rubric lists its five components.
 * The rubric is reference material a reader dips into for one answer; these are the terms a
 * person is agreeing to, and a document that hides its clauses behind a tap each is worse for
 * the reader than one that scrolls — nothing can be skim-read, and the reader cannot tell how
 * much there is. Scrolling costs a flick; a collapsed clause costs a decision per clause.
 */
export function LegalSections({ sections }: LegalSectionsProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();

  return (
    <View style={{ gap: spacing[6] }}>
      {sections.map((section, index) => (
        <Animated.View
          key={section.id}
          entering={
            reduced
              ? undefined
              : FadeInDown.delay(
                  Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                ).duration(motion.durations.base)
          }
          style={{ gap: spacing[2] }}
        >
          <Text {...a11yHeader()} variant="title">
            {section.heading}
          </Text>
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
        </Animated.View>
      ))}
    </View>
  );
}
