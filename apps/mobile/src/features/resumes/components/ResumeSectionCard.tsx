import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RESUME_SECTION_LABEL, type ResumeContent, type ResumeSectionKey } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { resumeSectionIsEmpty } from '../editorSections';
import { AddSectionTile } from './AddSectionTile';
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

const ACTION = 36;
const ACTION_GLYPH = 13;

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
 */
function SectionShimmer({ section }: { section: ResumeSectionKey }) {
  const { radii, spacing, s } = useTheme();
  const shape = SHIMMER[section];

  if (shape === 'chips') {
    return (
      <View style={[styles.wrap, { gap: spacing[2] }]}>
        {[0, 1, 2, 3, 4].map((key) => (
          <Skeleton key={key} width={s(88)} height={s(28)} radius="sm" />
        ))}
      </View>
    );
  }

  if (shape === 'prose') {
    return (
      <View style={{ gap: spacing[2] }}>
        <Skeleton height={s(18)} />
        <Skeleton height={s(18)} />
        <Skeleton width="70%" height={s(18)} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {[0, 1].map((key) => (
        <View key={key} style={{ gap: spacing[2] }}>
          <Skeleton width={s(180)} height={s(20)} radius="xs" />
          <Skeleton width={s(120)} height={s(16)} radius="xs" />
          <Skeleton height={s(16)} style={{ marginTop: spacing[1], borderRadius: radii.xs }} />
          <Skeleton width="85%" height={s(16)} />
        </View>
      ))}
    </View>
  );
}

/**
 * One §7.11 section: its label, an edit pen, an AI rewrite, and the body itself. An empty section
 * keeps its card and offers the dashed tile, so the six sections stay in their printed order
 * whether or not the document has filled them.
 */
export function ResumeSectionCard({
  content,
  section,
  index,
  regenerating,
  onEdit,
  onRegenerate,
}: ResumeSectionCardProps) {
  const { motion, spacing, s } = useTheme();
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
      <Card radius="card" padding={spacing[5]} style={{ gap: spacing[4] }}>
        <View style={[styles.header, { gap: spacing[1] }]}>
          <Text variant="label" accessibilityRole="header" style={styles.fill} numberOfLines={1}>
            {label}
          </Text>
          <IconButton
            icon="pen"
            label={`Edit ${label}`}
            variant="ghost"
            size={s(ACTION)}
            iconSize={s(ACTION_GLYPH)}
            iconColor="iconDefault"
            onPress={onEdit}
          />
          <AiBadge />
          <IconButton
            icon="magic"
            label={`Rewrite ${label} with AI`}
            variant="ghost"
            size={s(ACTION)}
            iconSize={s(ACTION_GLYPH)}
            iconColor="brand"
            disabled={regenerating}
            onPress={onRegenerate}
          />
        </View>

        {regenerating ? (
          <SectionShimmer section={section} />
        ) : empty ? (
          <AddSectionTile label={label} onPress={onEdit} />
        ) : (
          <ResumeSectionBody content={content} section={section} />
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
