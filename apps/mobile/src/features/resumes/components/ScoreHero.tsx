import { View } from 'react-native';

import {
  ATS_BAND_LABEL,
  SCORE_LABEL,
  scoreLead,
  summaryAfterLead,
  type AtsScore,
  type Resume,
} from '@/data/models';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { FlowCard } from '@/ui/kit';
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

/** The ring's size and stroke at 390. */
export const SCORE_HERO_RING = 108;
const RING_STROKE = 9;
/** The height of one action pill, for the loading shape. */
export const SCORE_HERO_LINK = 40;

/** A soft pill under the hero: "How it's scored", "Ask about it". */
function ActionPill({
  icon,
  label,
  a11y,
  hint,
  onPress,
}: {
  icon: LineIconName;
  label: string;
  a11y: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(a11y, hint)}
      feedback="subtle"
      haptic="selection"
      onPress={onPress}
      style={[styles.action, { backgroundColor: colors.brandSurface }]}
    >
      <Icon name={icon} size={u(16)} color={colors.brand} />
      <Text variant="footnote" color="brand">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The top of the score page (toreview §146.1, redesigned §177): one card with the ring, the band,
 * the count of required skills and what it means, then the document it scores. Two pills under
 * it: the rubric (V2 §7.8, every score links it) and the assistant about this score (§7.16).
 */
export function ScoreHero({ id, score, resume, onRubric, onAsk }: ScoreHeroProps) {
  const { u } = useTheme();
  const styles = useStyles();
  const { report } = score;
  const lead = scoreLead(report);
  const note = lead && report ? summaryAfterLead(report) : score.summary;

  return (
    <View style={styles.wrap}>
      <FlowCard style={styles.card}>
        <View style={styles.lead}>
          <ScoreRing
            score={score.total}
            valueText={String(Math.round(score.total))}
            label="out of 100"
            size={u(SCORE_HERO_RING)}
            strokeWidth={u(RING_STROKE)}
            ringColor={atsBandColor(score.band)}
            trackColor="surfaceSubtle"
            numberVariant="numberLg"
            numberColor="textPrimary"
            labelVariant="footnote"
            labelColor="textSecondary"
            accessibilityLabel={`ATS score ${score.total}, ${ATS_BAND_LABEL[score.band]}`}
            memoryKey={`ats:${id}`}
          />
          <View style={styles.text}>
            <ScoreBandPill band={score.band} style={styles.pill} />
            {lead ? (
              <View>
                <Text variant="title2" color="ink" {...a11yHeader(lead.headline)}>
                  {lead.headline}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {lead.detail}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {note ? (
          <Text variant="callout" color="textSecondary">
            {note}
          </Text>
        ) : null}
        <Text variant="footnote" color="textTertiary">
          {scoreContextLine(resume)}
        </Text>
      </FlowCard>

      <View style={styles.actions}>
        <ActionPill
          icon="BookOpen01"
          label="How it’s scored"
          a11y="What this score measures"
          hint={`Opens the rubric behind the ${SCORE_LABEL}`}
          onPress={onRubric}
        />
        {/* V2 §7.16 — the assistant opens with this document as its context. */}
        <ActionPill
          icon="Stars02"
          label="Ask about it"
          a11y="Ask about this score"
          hint="Opens the AI assistant about this document"
          onPress={onAsk}
        />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(14) },
  card: { gap: u(14), padding: u(20) },
  lead: { flexDirection: 'row', alignItems: 'center', gap: u(18) },
  text: { flex: 1, gap: u(8) },
  pill: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: u(10), flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    height: u(SCORE_HERO_LINK),
    paddingHorizontal: u(14),
    borderRadius: u(999),
  },
}));
