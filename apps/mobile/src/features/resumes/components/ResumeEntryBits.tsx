import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { REVIEW_PILL } from '../editorSections';

/** The bullet dot's artboard size, taken from `JobAboutSection` so both lists print alike. */
const BULLET = 5;

/**
 * One resume bullet. Deliberately the same row shape as the job description's responsibilities
 * (`JobAboutSection`) — the reader is comparing the two documents, so the lists must match.
 */
export function EntryBullet({ label }: { label: string }) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <View
        style={{
          width: s(BULLET),
          height: s(BULLET),
          marginTop: spacing[2] + 1,
          borderRadius: radii.full,
          backgroundColor: colors.iconMuted,
        }}
      />
      <Text variant="bulletBody" color="textBody" style={styles.fill}>
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
