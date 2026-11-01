import { View } from 'react-native';

import {
  ATS_BAND_LABEL,
  SCORE_LABEL,
  scoreLead,
  summaryAfterLead,
  type AtsScore,
  type Resume,
} from '@/data/models';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { atsBandColor, scoreContextLine } from '../docMeta';
import { ScoreBandPill } from './ScoreBandPill';

export type ScoreHeroProps = {
  id: string;
  score: AtsScore;
  resume: Resume;
  onRubric: () => void;
  onAsk: () => void;
};

// The ring beside the count (toreview §146.1), at TAILOR 02's size (607:25).
export const SCORE_HERO_RING = 86 / 0.75;
const RING_STROKE = 6.45 / 0.75;
/** RESUMES 04's rhythm at 390 (95:2310), in artboard units: lead → summary, summary → context. */
const SUMMARY_TOP = 25;
const CONTEXT_TOP = 11;
/** The rubric link is one `captionSemiBold` line; `hitSlopFor` pads it out to the 44pt floor. */
export const SCORE_HERO_LINK = 20;

/**
 * The top of the score panel (owner, 2026-11-01, toreview §146.1): the count of required skills
 * leads, with a smaller ring beside it, then what's left of the summary, where the number applies,
 * and the two links every score carries. A score with no job to count against keeps the band and
 * its summary.
 */
export function ScoreHero({ id, score, resume, onRubric, onAsk }: ScoreHeroProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const { report } = score;
  const lead = scoreLead(report);
  const note = lead && report ? summaryAfterLead(report) : score.summary;

  return (
    <View>
      <View style={[styles.lead, { gap: spacing[4] }]}>
        <View style={[styles.text, { gap: spacing[2] }]}>
          {lead ? (
            <View>
              <Text variant="headlineLg">{lead.headline}</Text>
              <Text variant="captionSemiBold" color="textSecondary">
                {lead.detail}
              </Text>
            </View>
          ) : null}
          <ScoreBandPill band={score.band} style={styles.pill} />
        </View>
        <ScoreRing
          score={score.total}
          label="ATS SCORE"
          size={s(SCORE_HERO_RING)}
          strokeWidth={s(RING_STROKE)}
          ringColor={atsBandColor(score.band)}
          trackColor="surfaceSubtle"
          numberVariant="tailorRingValue"
          numberColor="textPrimary"
          labelVariant="microOverline"
          labelColor="textSecondary"
          accessibilityLabel={`ATS score ${score.total}, ${ATS_BAND_LABEL[score.band]}`}
          // The library card's memory: opened from it, the ring carries on from the score the
          // card showed instead of sweeping up from 0 on every visit; a fix sweeps old → new.
          memoryKey={`ats:${id}`}
        />
      </View>

      {note ? (
        <Text variant="scoreSummary" color="textSecondary" style={{ marginTop: s(SUMMARY_TOP) }}>
          {note}
        </Text>
      ) : null}
      <Text
        variant="scoreContext"
        color="textTertiary"
        style={{ marginTop: s(note ? CONTEXT_TOP : SUMMARY_TOP) }}
      >
        {scoreContextLine(resume)}
      </Text>

      {/* V2 §7.8 — every score display carries a link to the published rubric. */}
      <Pressable
        {...a11yButton('What this score measures', `Opens the rubric behind the ${SCORE_LABEL}`)}
        feedback="subtle"
        haptic="selection"
        hitSlop={hitSlopFor(s(SCORE_HERO_LINK))}
        onPress={onRubric}
        style={{ marginTop: spacing[4] }}
      >
        <Text variant="captionSemiBold" color="link">
          What this score measures
        </Text>
      </Pressable>
      {/* V2 §7.16 — the assistant opens with this document as its context. */}
      <Pressable
        {...a11yButton('Ask about this score', 'Opens the AI assistant about this document')}
        feedback="subtle"
        haptic="selection"
        hitSlop={hitSlopFor(s(SCORE_HERO_LINK))}
        onPress={onAsk}
        style={{ marginTop: spacing[4] }}
      >
        <Text variant="captionSemiBold" color="link">
          Ask about this score
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  lead: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  pill: { alignSelf: 'flex-start' },
}));
