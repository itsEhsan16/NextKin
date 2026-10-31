import { View } from 'react-native';

import type { CoverLetterContent, CoverLetterTone } from '@/data/models';
import { FlowHero } from '@/features/create/components/FlowHero';
import { scaledSheet } from '@/theme';
import { StateView } from '@/ui/StateView';

import { CoverLetterCard } from './CoverLetterCard';
import { CoverToneChips } from './CoverToneChips';
import { coverReadyLede } from './coverRun';

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
  tones: readonly CoverLetterTone[];
  onPickTone: (tone: CoverLetterTone) => void;
  tonesDisabled?: boolean;
  quotaSpent?: boolean;
};

// COVER 03 at 390 (644:148), in artboard units.
const HERO_TO_LETTER = 20 / 0.75; // 644:175 → 644:179
const LETTER_TO_TONES = 22 / 0.75; // 644:179 → 644:194

/** COVER 03 (644:148) under the stepper: the hero, the letter, and the other tones. */
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
  const styles = useStyles();

  return (
    <View>
      <FlowHero title="Your cover letter is ready!" lede={coverReadyLede(job, resumeTitle)} />

      <View style={styles.letter}>
        {letterError ? (
          <StateView
            tone="danger"
            icon="AlertTriangle"
            title="Couldn't load the letter"
            message="It is saved in Resumes. Check your connection and try again."
            actionLabel="Try again"
            onAction={onRetryLetter}
          />
        ) : (
          <CoverLetterCard letter={letter} job={job} resumeTitle={resumeTitle} onEdit={onEdit} />
        )}
      </View>

      <View style={styles.tones}>
        <CoverToneChips
          tones={tones}
          onPick={onPickTone}
          disabled={tonesDisabled}
          spent={quotaSpent}
        />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  letter: { marginTop: s(HERO_TO_LETTER) },
  tones: { marginTop: s(LETTER_TO_TONES) },
}));
