import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Dev-only: the mock mode switch is the one place outside src/data that may touch the mock layer.
import { MOCK_MODES, useMockModeStore } from '@/data/mock/mode';
import { useNotifications, useResumes, useUnreadCount } from '@/data/queries';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Screen, Text } from '@/ui';
import { DevButton, DevSection } from '@/ui/dev';

type QueryState = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
};

function StatusLine({ label, query }: { label: string; query: QueryState }) {
  const { colors, spacing } = useTheme();
  const status = query.isPending
    ? 'loading'
    : query.isError
      ? `error: ${query.error instanceof Error ? query.error.message : String(query.error)}`
      : query.isFetching
        ? 'refetching'
        : 'ready';
  const color = query.isError
    ? 'danger'
    : query.isPending || query.isFetching
      ? 'warning'
      : 'success';

  return (
    <View style={[styles.row, { gap: spacing[2] }]}>
      {query.isPending || query.isFetching ? <ActivityIndicator color={colors.brand} /> : null}
      <Text variant="caption" color="textSecondary">
        {label}:
      </Text>
      <Text variant="captionSemiBold" color={color} style={styles.grow} numberOfLines={2}>
        {status}
      </Text>
    </View>
  );
}

export default function MockRoute() {
  const { spacing, colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const mode = useMockModeStore((s) => s.mode);
  const setMode = useMockModeStore((s) => s.setMode);

  const resumes = useResumes();
  const notifications = useNotifications();
  const unread = useUnreadCount();

  const current = MOCK_MODES.find((m) => m.key === mode);

  return (
    <Screen scroll edges={[]}>
      <DevSection title="Mock mode" description={current?.description ?? ''}>
        <View style={[styles.wrap, { gap: spacing[2] }]}>
          {MOCK_MODES.map((meta) => (
            <DevButton
              key={meta.key}
              label={meta.label}
              active={meta.key === mode}
              onPress={() => {
                setMode(meta.key);
                void queryClient.invalidateQueries();
              }}
            />
          ))}
        </View>
      </DevSection>

      <DevSection title="useResumes()">
        <View
          style={{
            gap: spacing[2],
            padding: spacing[4],
            borderRadius: radii.card,
            backgroundColor: colors.surfaceSubtle,
          }}
        >
          <StatusLine label="status" query={resumes} />
          {resumes.data ? (
            resumes.data.length === 0 ? (
              <Text variant="body" color="textSecondary">
                No resumes yet (empty state).
              </Text>
            ) : (
              <View style={{ gap: spacing[1] }}>
                <Text variant="bodySemiBold">{pluralize(resumes.data.length, 'resume')}</Text>
                {resumes.data.slice(0, 3).map((resume) => (
                  <Text key={resume.id} variant="captionRegular" color="textBody" numberOfLines={1}>
                    {'•'} {resume.title}
                    {resume.atsScore != null ? ` · ATS ${resume.atsScore}` : ''}
                  </Text>
                ))}
              </View>
            )
          ) : null}
        </View>
      </DevSection>

      <DevSection title="useNotifications() + useUnreadCount()">
        <View
          style={{
            gap: spacing[2],
            padding: spacing[4],
            borderRadius: radii.card,
            backgroundColor: colors.surfaceSubtle,
          }}
        >
          <StatusLine label="status" query={notifications} />
          {notifications.data ? (
            <Text variant="bodySemiBold">
              {pluralize(notifications.data.length, 'notification')} · {unread.data ?? 0} unread
            </Text>
          ) : null}
        </View>
      </DevSection>

      <View style={{ marginTop: spacing[6] }}>
        <DevButton
          label="Refetch everything"
          onPress={() => void queryClient.invalidateQueries()}
          active
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  grow: { flex: 1 },
});
