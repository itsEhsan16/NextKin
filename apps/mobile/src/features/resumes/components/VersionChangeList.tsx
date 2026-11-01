import { Fragment } from 'react';
import { View } from 'react-native';

import type { VersionChange } from '@/data/models';
import { useVersionChanges } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type VersionChangeListProps = { resumeId: string; versionId: string };

const RULE = 1 / 0.75;

function ChangeRow({ change }: { change: VersionChange }) {
  const { spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[
        change.where,
        change.text,
        change.before ? `It was: ${change.before}` : '',
        change.why,
      ]
        .filter(Boolean)
        .join('. ')}
      style={{ gap: spacing[1] }}
    >
      <Text variant="micro" color="textTertiary">
        {change.where}
      </Text>
      <Text variant="caption" color="textBody">
        {change.text}
      </Text>
      {change.before ? (
        <Text variant="micro" color="textSecondary">
          {`Was: ${change.before}`}
        </Text>
      ) : null}
      <Text variant="micro" color="textSecondary">
        {change.why}
      </Text>
    </View>
  );
}

function Group({ title, changes }: { title: string; changes: readonly VersionChange[] }) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  if (changes.length === 0) return null;
  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="captionSemiBold">{title}</Text>
      {changes.map((change, index) => (
        <Fragment key={`${change.where}:${change.text}`}>
          {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
          <ChangeRow change={change} />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * What one version changed and why (toreview §146.5), loaded when its row opens: what went in or
 * was reworded, then what came out. Spec-derived from the app's text styles and rules.
 */
export function VersionChangeList({ resumeId, versionId }: VersionChangeListProps) {
  const { spacing, s } = useTheme();
  const changes = useVersionChanges(resumeId, versionId);

  if (!changes.data && changes.isPending) {
    return (
      <View accessible accessibilityLabel="Loading what changed" style={{ gap: spacing[2] }}>
        <Skeleton height={s(18)} />
        <Skeleton width="70%" height={s(18)} />
      </View>
    );
  }

  if (!changes.data) {
    return (
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" color="textSecondary">
          We couldn’t load what changed. Check your connection and try again.
        </Text>
        <Button label="Try again" variant="ghost" onPress={() => void changes.refetch()} />
      </View>
    );
  }

  if (changes.data.length === 0) {
    return (
      <Text variant="caption" color="textSecondary">
        No lines changed in this version.
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing[5] }}>
      <Group title="Added or changed" changes={changes.data.filter((c) => c.kind !== 'removed')} />
      <Group title="Left out" changes={changes.data.filter((c) => c.kind === 'removed')} />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  rule: { height: s(RULE) },
}));
