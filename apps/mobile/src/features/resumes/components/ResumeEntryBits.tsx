import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { REVIEW_PILL } from '../editorSections';

// The bullet at 390 (RESUMES 06 577:7109), in artboard units: a 5pt dot centred on the first
// line, 10 before the text.
const BULLET = 5 / 0.75;
const BULLET_TOP = 7.5 / 0.75;
const BULLET_GAP = 10 / 0.75;

/** One resume bullet: a grey dot and the line (RESUMES 06 577:7109). */
export function EntryBullet({ label }: { label: string }) {
  const { colors, radii, s } = useTheme();

  return (
    <View style={[styles.row, { gap: s(BULLET_GAP) }]}>
      <View
        style={{
          width: s(BULLET),
          height: s(BULLET),
          marginTop: s(BULLET_TOP),
          borderRadius: radii.full,
          backgroundColor: colors.iconMuted,
        }}
      />
      <Text variant="body" color="textBody" style={styles.fill}>
        {label}
      </Text>
    </View>
  );
}

/**
 * V2 §7.9 — the pill on a role, project or education entry Zero Resume Mode assumed. It is the
 * visible half of the download gate: the same flag that disables Download draws this, so the
 * reader can see which entry is holding the document back rather than hunting for it.
 */
export function ReviewPill() {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radii.sm,
        backgroundColor: colors.warningSurface,
        paddingHorizontal: s(10),
        paddingTop: s(4),
        paddingBottom: s(6),
        marginTop: spacing[1],
      }}
    >
      <Text variant="captionSemiBold" color="warningStrong">
        {REVIEW_PILL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  fill: { flex: 1 },
});
