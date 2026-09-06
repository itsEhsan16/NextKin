import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ACTIVITY_KIND_ICON, ACTIVITY_KIND_LABEL, type ActivityEntry } from '@/data/models';
import { VisualTile } from '@/features/notifications';
import { formatFeedTime, parseBold, stripBold } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type ActivityRowProps = {
  entry: ActivityEntry;
  onOpen: (entry: ActivityEntry) => void;
};

/** The notifications row's own inset for its trailing divider, so the two feeds line up. */
const DIVIDER_INSET = 76;

/**
 * One line of the History feed. The same shape as a notification row — the 40pt tile, the bold
 * runs, the feed time — with two things deliberately missing: there is no unread state and no
 * swipe, because this is an append-only audit trail and nothing on it is yours to mark or delete.
 *
 * A row with no destination (a run that produced nothing to open) is plain text. It is not a
 * Pressable that goes nowhere, and it does not look like one.
 */
export const ActivityRow = memo(function ActivityRow({ entry, onOpen }: ActivityRowProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const runs = parseBold(entry.title);
  const time = formatFeedTime(entry.createdAt);
  const summary = [ACTIVITY_KIND_LABEL[entry.kind], stripBold(entry.title), entry.detail, time]
    .filter(Boolean)
    .join(', ');

  const body = (
    <View style={[styles.row, { gap: spacing[3] }]}>
      {/* The notifications tile, handed an activity glyph: genuine reuse, not a second tile. */}
      <VisualTile
        visual={{ kind: 'glyph', icon: ACTIVITY_KIND_ICON[entry.kind], tone: 'neutral' }}
      />
      <View style={styles.body}>
        <Text variant="body" color="textBody">
          {runs.map((run, index) =>
            run.bold ? (
              <Text key={index} variant="bodySemiBold" color="textPrimary">
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
        </Text>
        {entry.detail ? (
          <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[1] }}>
            {entry.detail}
          </Text>
        ) : null}
        <Text variant="captionSm" color="textTertiary" style={{ marginTop: spacing[2] }}>
          {time}
        </Text>
      </View>
    </View>
  );

  const padding = {
    paddingLeft: spacing.gutter,
    paddingRight: spacing.gutter + s(12),
    paddingVertical: spacing[4],
  };

  return (
    <View>
      {entry.deepLink ? (
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={summary}
          accessibilityHint="Opens what this was about"
          feedback="subtle"
          haptic="light"
          onPress={() => onOpen(entry)}
          style={padding}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={summary} style={padding}>
          {body}
        </View>
      )}
      <View
        style={[styles.divider, { marginLeft: s(DIVIDER_INSET), backgroundColor: colors.divider }]}
      />
    </View>
  );
});

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
}));
