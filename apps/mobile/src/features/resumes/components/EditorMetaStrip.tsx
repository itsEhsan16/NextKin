import { StyleSheet, View } from 'react-native';

import {
  COVER_LETTER_TONE_LABEL,
  SCORE_LABEL,
  type DocumentContent,
  type Resume,
} from '@/data/models';
import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { versionLine } from '../editorSections';
import { AtsBadge } from './AtsBadge';

export type EditorMetaStripProps = {
  resume: Resume;
  content?: DocumentContent;
  onOpenScore: () => void;
  onOpenRubric: () => void;
};

/** The rubric link is one `captionSemiBold` line, padded out to the 44pt floor. */
const LINK_HEIGHT = 20;

/**
 * The line under the editor's header: the score, the document's history, and whatever else is
 * true of it right now (V2 §7.11).
 *
 * An unscored draft is normal rather than broken — nothing is scored until the first run finishes
 * — so the absence of a score is stated quietly instead of drawn as a zero or an empty ring.
 *
 * The tone of a cover letter is shown here READ-ONLY. Rewriting a letter in another tone spends a
 * cover-letter generation and needs §13.5's quota in front of it, which belongs to the letter flow
 * (Phase 9D); a picker on this strip would spend the allowance with no cap in sight.
 */
export function EditorMetaStrip({
  resume,
  content,
  onOpenScore,
  onOpenRubric,
}: EditorMetaStripProps) {
  const { spacing, s } = useTheme();
  const scored = resume.atsScore != null;

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={[styles.row, { gap: spacing[4] }]}>
        {resume.atsScore != null ? (
          <AtsBadge score={resume.atsScore} onPress={onOpenScore} />
        ) : (
          <Text variant="captionSm" color="textTertiary">
            Not scored yet
          </Text>
        )}

        <View style={[styles.meta, { gap: spacing[2] }]}>
          <Text variant="caption" color="textSecondary">
            {versionLine(resume)}
          </Text>

          <View style={[styles.wrap, { gap: spacing[2] }]}>
            {resume.updateAvailable ? <Chip label="Update available" /> : null}
            {content?.kind === 'cover_letter' ? (
              <Chip label={COVER_LETTER_TONE_LABEL[content.tone]} />
            ) : null}
          </View>
        </View>
      </View>

      {/* V2 §7.8 — every score display carries a link to the published rubric. */}
      {scored ? (
        <Pressable
          {...a11yButton('What this score measures', `Opens the rubric behind the ${SCORE_LABEL}`)}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(s(LINK_HEIGHT))}
          onPress={onOpenRubric}
          style={styles.link}
        >
          <Text variant="captionSemiBold" color="link">
            What this score measures
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  meta: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  link: { alignSelf: 'flex-start' },
});
