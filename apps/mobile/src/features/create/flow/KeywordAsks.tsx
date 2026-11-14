import { View } from 'react-native';

import type { KeywordQuestion } from '@/data/models';
import { tickKeyword, togglePlace, type CustomizeChoices } from '@/data/models/customize';
import { questionText } from '@/data/models/questions';
import { scaledSheet } from '@/theme';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';

import { FlowCard, FlowDivider, FlowSection } from './FlowKit';

/** A phone shows a few at a time; the rest stay in the keyword chips above. */
const SHOWN = 4;

const SEGMENTS = [
  { key: 'no' as const, label: 'No' },
  { key: 'yes' as const, label: 'Yes' },
];

/**
 * "Did you use these?" (owner, 2026-11-15; toreview §206.3): a skill the job asks for, beside the
 * line of the user's own resume that hints they used it. "Yes" confirms it at that role as their
 * own word; "No" is where each starts and adds nothing. Spec-derived (no artboard draws it), from
 * the flow kit's card and the shared segmented control. Nothing to ask draws nothing.
 */
export function KeywordAsks({
  questions,
  choices,
  onChange,
}: {
  questions: readonly KeywordQuestion[];
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const styles = useStyles();
  const shown = questions.slice(0, SHOWN);
  if (shown.length === 0) return null;

  return (
    <FlowSection title="Did you use these?" body="Only say yes if it’s true.">
      <FlowCard style={styles.card}>
        {shown.map((q, index) => {
          const yes = choices.places[q.keyword]?.where.includes(q.where) ?? false;
          return (
            <View key={`${q.keyword}@${q.where}`} style={styles.item}>
              {index > 0 ? <FlowDivider /> : null}
              <Text variant="bodyLgStrong" color="ink">
                {questionText(q)}
              </Text>
              <Text variant="footnote" color="textSecondary">
                Your resume says: “{q.line}”
              </Text>
              <SegmentedControl
                size="sm"
                segments={SEGMENTS}
                value={yes ? 'yes' : 'no'}
                onChange={(next) =>
                  onChange(
                    next === 'yes'
                      ? togglePlace(choices, q.keyword, q.where, true)
                      : tickKeyword(choices, q.keyword, false),
                  )
                }
              />
            </View>
          );
        })}
      </FlowCard>
    </FlowSection>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  card: { gap: u(14) },
  item: { gap: u(8) },
}));
