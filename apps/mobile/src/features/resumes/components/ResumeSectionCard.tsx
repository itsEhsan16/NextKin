import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { RESUME_SECTION_LABEL, type ResumeContent, type ResumeSectionKey } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
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
  const { spacing, s } = useTheme();
  const shape = SHIMMER[section];

  if (shape === 'chips') {
    return (
      // One strip, the chips' two rows (§191).
      <Skeleton height={s(28) * 2 + spacing[2]} radius="lg" tone="ai" />
    );
  }

  if (shape === 'prose') {
    return (
      // One block, the three lines' height (§191).
      <Skeleton height={s(18) * 3 + spacing[2] * 2} radius="md" tone="ai" />
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {/* One block per entry, the entry's own height (§191). */}
      {[0, 1].map((key) => (
        <Skeleton
          key={key}
          height={s(20) + s(16) * 3 + spacing[2] * 3 + spacing[1]}
          radius="md"
          tone="ai"
        />
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
  const { colors, spacing, s } = useTheme();
  const label = RESUME_SECTION_LABEL[section];
  const empty = resumeSectionIsEmpty(content, section);

  // No entrance: the cards replayed it on every visit to the editor (§191).
  return (
    <Animated.View>
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
