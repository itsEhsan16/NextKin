import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RESUME_SECTION_LABEL, type ResumeContent, type ResumeSectionKey } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { RESUME_SECTION_ART, SECTION_ART_WIDTH } from '../editorArt';
import { resumeSectionIsEmpty } from '../editorSections';
import { AddSectionTile } from './AddSectionTile';
import { AiPill } from './AiPill';
import { ResumeSectionBody } from './ResumeSectionBody';

export type ResumeSectionCardProps = {
  content: ResumeContent;
  section: ResumeSectionKey;
  /** Position in `RESUME_SECTION_ORDER`, for the entrance stagger. */
  index: number;
  /** The AI rewrite is running over THIS section — its body shimmers until the copy lands. */
  regenerating: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
};

// The section card at 390 (RESUMES 06 577:6991), in artboard units.
const CARD_INNER_GAP = 14 / 0.75;
const HEADER_GAP = 10 / 0.75;
const ICON_SLOT_W = 34 / 0.75;
const ICON_SLOT_H = 28 / 0.75;
const ACTIONS_GAP = 8 / 0.75;
const EDIT = 32 / 0.75;

/** Which shimmer geometry stands in for each section's body while the AI rewrites it. */
const SHIMMER: Record<ResumeSectionKey, 'prose' | 'chips' | 'entries'> = {
  summary: 'prose',
  skills: 'chips',
  certifications: 'chips',
  experience: 'entries',
  projects: 'entries',
  education: 'entries',
};

/**
 * The regenerate mutation is deliberately not optimistic (`useRegenerateSection`) — there is
 * nothing honest to guess at the model's output — so the section holds blocks shaped like the
 * body it is replacing, and the card keeps its height instead of collapsing and springing back.
 * The blocks pulse on the brand tint (`Skeleton tone="ai"`): the AI is writing this part, which
 * is a different wait from the page loading (§85).
 */
function SectionShimmer({ section }: { section: ResumeSectionKey }) {
  const { radii, spacing, s } = useTheme();
  const shape = SHIMMER[section];

  if (shape === 'chips') {
    return (
      <View style={[styles.wrap, { gap: spacing[2] }]}>
        {[0, 1, 2, 3, 4].map((key) => (
          <Skeleton key={key} width={s(88)} height={s(28)} radius="sm" tone="ai" />
        ))}
      </View>
    );
  }

  if (shape === 'prose') {
    return (
      <View style={{ gap: spacing[2] }}>
        <Skeleton height={s(18)} tone="ai" />
        <Skeleton height={s(18)} tone="ai" />
        <Skeleton width="70%" height={s(18)} tone="ai" />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {[0, 1].map((key) => (
        <View key={key} style={{ gap: spacing[2] }}>
          <Skeleton width={s(180)} height={s(20)} radius="xs" tone="ai" />
          <Skeleton width={s(120)} height={s(16)} radius="xs" tone="ai" />
          <Skeleton
            height={s(16)}
            tone="ai"
            style={{ marginTop: spacing[1], borderRadius: radii.xs }}
          />
          <Skeleton width="85%" height={s(16)} tone="ai" />
        </View>
      ))}
    </View>
  );
}

/**
 * One §7.11 section, drawn as a RESUMES 06 card (577:6991): the section's illustrated icon and
 * name, an AI rewrite pill and an edit pen, then the body. An empty section keeps its card and
 * offers the dashed tile, so the six sections stay in their printed order whether or not the
 * document has filled them.
 */
export function ResumeSectionCard({
  content,
  section,
  index,
  regenerating,
  onEdit,
  onRegenerate,
}: ResumeSectionCardProps) {
  const { colors, motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const label = RESUME_SECTION_LABEL[section];
  const empty = resumeSectionIsEmpty(content, section);

  const entering = reduced
    ? undefined
    : FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * motion.stagger.card).duration(
        motion.durations.base,
      );

  return (
    <Animated.View entering={entering}>
      <ProfileCard style={{ padding: spacing[5], gap: s(CARD_INNER_GAP) }}>
        <View style={[styles.header, { gap: s(HEADER_GAP) }]}>
          <View style={{ width: s(ICON_SLOT_W), height: s(ICON_SLOT_H), ...styles.centre }}>
            <Art art={RESUME_SECTION_ART[section]} width={SECTION_ART_WIDTH} />
          </View>
          <Text
            variant="title3"
            color="ink"
            accessibilityRole="header"
            style={styles.fill}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View style={[styles.header, { gap: s(ACTIONS_GAP) }]}>
            <AiPill
              actionLabel={`Rewrite ${label} with AI`}
              disabled={regenerating}
              working={regenerating}
              onPress={onRegenerate}
            />
            <IconButton
              icon="Edit03"
              label={`Edit ${label}`}
              size={s(EDIT)}
              iconSize="sm"
              iconColor="textPrimary"
              onPress={onEdit}
              style={{ backgroundColor: colors.surfaceCard }}
            />
          </View>
        </View>

        {regenerating ? (
          <SectionShimmer section={section} />
        ) : empty ? (
          <AddSectionTile label={label} onPress={onEdit} />
        ) : (
          <ResumeSectionBody content={content} section={section} />
        )}
      </ProfileCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
