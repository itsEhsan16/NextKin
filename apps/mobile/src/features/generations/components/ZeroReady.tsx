import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { zeroSummary, type ResumeContent } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

import { NextStepNote } from './NextStepNote';
import { ResumePagePreview } from './ResumePagePreview';
import { TailorCheckRow } from './TailorCheckRow';

export type ZeroReadyProps = {
  content: ResumeContent;
  name: string;
  /** The job "Start from nothing" was picked on (ZERO 00b); the next step names it. */
  company?: string;
};

// ZERO 05 at 390 (613:622), in artboard units.
const STAGE_TO_TEXT = 16 / 0.75; // 613:670
const TITLE_TO_LINE = 6 / 0.75; // 613:671
const LINE_GAP = 8 / 0.75; // 613:673
const PILL_PAD_L = 9 / 0.75; // 613:674
const PILL_PAD_R = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const PILL_GLYPH = 9.5 / 0.75;
const TEXT_TO_CARD = 18 / 0.75; // 613:678
const CARD_PAD = 14 / 0.75;
const HEADER_PAD_B = 4 / 0.75; // 613:680
const CARD_TO_NEXT = 14 / 0.75; // 613:701

/**
 * ZERO 05 (613:622) under the stepper: the finished resume, "Your first resume is ready" with how
 * many guesses were checked and where else it went, what was checked, and what to do next. No
 * score: a first resume written for no job carries none (D-15), as the board shows.
 */
export function ZeroReady({ content, name, company }: ZeroReadyProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const total = content.review?.total ?? 0;

  return (
    <View>
      <ResumePagePreview content={content} name={name} />

      <View style={styles.text}>
        <Text variant="headlineLg" align="center" {...a11yHeader()}>
          Your first resume is ready
        </Text>
        <View style={styles.line}>
          <View
            style={[
              styles.pill,
              { borderRadius: radii.full, backgroundColor: colors.successSurface },
            ]}
          >
            <FontAwesome5 name="check" size={s(PILL_GLYPH)} color={colors.success} solid />
            <Text variant="captionSemiBold" color="success">
              {total > 0 ? `All ${total} checked` : 'All checked'}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary">
            Saved to your profile too
          </Text>
        </View>
      </View>

      <Card radius="cardLg" style={styles.card}>
        <Text variant="titleSm" {...a11yHeader()} style={styles.header}>
          What you checked
        </Text>
        {zeroSummary(content).map((line) => (
          <TailorCheckRow key={line} label={line} state="done" />
        ))}
      </Card>

      <NextStepNote
        icon="magic"
        text={
          company
            ? `Next: tailor it to the ${company} job`
            : 'Next: tailor it to a job you want to apply for'
        }
        style={styles.next}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  text: { marginTop: s(STAGE_TO_TEXT), alignItems: 'center', gap: s(TITLE_TO_LINE) },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(LINE_GAP),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_L),
    paddingRight: s(PILL_PAD_R),
    paddingVertical: s(PILL_PAD_Y),
  },
  card: { marginTop: s(TEXT_TO_CARD), padding: s(CARD_PAD) },
  header: { paddingBottom: s(HEADER_PAD_B) },
  next: { marginTop: s(CARD_TO_NEXT) },
}));
