import { View } from 'react-native';

import type { PlausibilityNote } from '@/data/models/jd';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pill } from '@/ui/Pill';
import { Text } from '@/ui/Text';

const SEVERITY = { impossible: 'Not possible', suspect: 'Looks off' } as const;

/**
 * "Requirements to double-check" (toreview §129): what the job asks that nobody could have, such
 * as 20 years of a technology released 13 years ago. Each note says what it rests on and what the
 * score does about it. Nothing to say draws nothing.
 */
export function JdDoubleCheck({ notes }: { notes: readonly PlausibilityNote[] }) {
  const { colors, radii, spacing } = useTheme();
  const styles = useStyles();
  if (notes.length === 0) return null;

  return (
    <View
      style={[
        styles.box,
        {
          gap: spacing[3],
          padding: spacing[4],
          borderRadius: radii.card,
          backgroundColor: colors.warningSurface,
        },
      ]}
    >
      <View style={[styles.line, { gap: spacing[2] }]}>
        <Icon name="AlertTriangle" size="sm" color={colors.warningStrong} />
        <Text {...a11yHeader()} variant="captionSemiBold" color="warningStrong">
          Requirements to double-check
        </Text>
      </View>
      {notes.map((note) => (
        <View
          key={`${note.code}:${note.skill ?? note.title}`}
          accessible
          accessibilityLabel={`${note.title}. ${SEVERITY[note.severity]}. ${note.detail}`}
          style={{ gap: spacing[1] }}
        >
          <View style={[styles.line, styles.wrap, { gap: spacing[2] }]}>
            <Text variant="captionSemiBold" style={styles.shrink}>
              {note.title}
            </Text>
            <Pill label={SEVERITY[note.severity]} tone="plain" />
          </View>
          <Text variant="micro" color="textSecondary">
            {note.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  box: { alignSelf: 'stretch' },
  line: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
}));
