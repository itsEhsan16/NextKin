import { View } from 'react-native';

import {
  COVER_LETTER_TONE_LABEL,
  type CoverLetterContent,
  type CoverLetterTone,
} from '@/data/models';
import { FlowCard, StatusPill } from '@/features/create/flow/FlowKit';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

export type CoverReadyProps = {
  letter?: CoverLetterContent;
  /** The letter's body could not be read; the page offers a retry in its place. */
  letterError?: boolean;
  onRetryLetter: () => void;
  onEdit: () => void;
  /** The job the letter was written for, once it has loaded. */
  job?: { title: string; company: string };
  /** The source resume's title — "Stripe — Senior PD". */
  resumeTitle?: string;
  /** The tones this draft is not in. */
  tones: readonly CoverLetterTone[];
  onPickTone: (tone: CoverLetterTone) => void;
  tonesDisabled?: boolean;
  quotaSpent?: boolean;
};

const wordsIn = (letter: CoverLetterContent): number =>
  [letter.greeting, ...letter.paragraphs, letter.signoff].join(' ').split(/\s+/).filter(Boolean)
    .length;

/**
 * A finished cover letter (toreview §173, Figma "Cover · 2 Ready"): Saved to Resumes, the title,
 * the tone and length, the letter itself up front, and the other tones to rewrite it in. Edit and
 * Download sit in the footer like every other result.
 */
export function CoverReady({
  letter,
  letterError,
  onRetryLetter,
  onEdit,
  job,
  resumeTitle,
  tones,
  onPickTone,
  tonesDisabled,
  quotaSpent,
}: CoverReadyProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const title = job ? `Your letter for ${job.company}` : 'Your cover letter is ready';
  const meta = letter
    ? `${COVER_LETTER_TONE_LABEL[letter.tone]} tone · ${wordsIn(letter)} words`
    : resumeTitle
      ? `Written from ${resumeTitle}`
      : undefined;

  return (
    <View style={styles.wrap}>
      <StatusPill label="Saved to Resumes" icon="Check" />
      <View style={styles.titleBlock}>
        <Text variant="title1" color="ink" {...a11yHeader()}>
          {title}
        </Text>
        {meta ? (
          <Text variant="bodyLg" color="textSecondary">
            {meta}
          </Text>
        ) : null}
      </View>

      {letterError ? (
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn’t load the letter"
          message="It’s saved in Resumes. Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetryLetter}
        />
      ) : (
        <FlowCard style={styles.letter}>
          {letter ? (
            <>
              <Text variant="callout" color="ink">
                {letter.greeting}
              </Text>
              {letter.paragraphs.slice(0, 2).map((paragraph) => (
                <Text key={paragraph} variant="callout" color="ink">
                  {paragraph}
                </Text>
              ))}
              <Pressable
                feedback="subtle"
                accessibilityRole="button"
                accessibilityLabel="Read the full letter"
                onPress={onEdit}
                style={styles.link}
              >
                <Text variant="footnote" color="brand">
                  Read full letter
                </Text>
                <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
              </Pressable>
            </>
          ) : (
            <View style={styles.skeleton} accessible accessibilityLabel="Loading the letter">
              {/* One block, the four lines' height (§191). */}
              <Skeleton height={u(14) * 4 + u(10) * 3} radius="md" />
            </View>
          )}
        </FlowCard>
      )}

      {tones.length > 0 ? (
        <View style={styles.tones}>
          <Text variant="footnote" color="textSecondary">
            {quotaSpent ? 'Try another tone · needs Pro' : 'Try another tone'}
          </Text>
          <View style={styles.chips}>
            {tones.map((tone) => (
              <ChoiceChip
                key={tone}
                label={COVER_LETTER_TONE_LABEL[tone]}
                selected={false}
                locked={tonesDisabled}
                onPress={() => onPickTone(tone)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(18), paddingTop: u(4), width: '100%' },
  titleBlock: { gap: u(6) },
  letter: { gap: u(12), paddingHorizontal: u(20), paddingVertical: u(20) },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2), alignSelf: 'flex-start' },
  skeleton: { gap: u(10) },
  tones: { gap: u(10) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
}));
