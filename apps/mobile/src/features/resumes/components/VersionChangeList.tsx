import { Fragment } from 'react';
import { View } from 'react-native';

import type { VersionChange } from '@/data/models';
import { useVersionChanges } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { useRestoreLine, type RestoreState } from '../hooks/useRestoreLine';

export type VersionChangeListProps = { resumeId: string; versionId: string };

const RULE = 1 / 0.75;

const keyOf = (change: VersionChange) => `${change.where}:${change.text}`;

type RowProps = { change: VersionChange; restoring?: RestoreState; onRestore?: () => void };

function ChangeRow({ change, restoring, onRestore }: RowProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ gap: spacing[2] }}>
      <ChangeCopy change={change} />
      {change.restore && onRestore ? (
        restoring === 'done' ? (
          <Text variant="micro" color="success">
            Back on your resume
          </Text>
        ) : (
          <Button
            label="Restore"
            icon="ClockRewind"
            variant="soft"
            size="md"
            loading={restoring === 'saving'}
            onPress={onRestore}
            style={styles.restore}
          />
        )
      ) : null}
    </View>
  );
}

function ChangeCopy({ change }: { change: VersionChange }) {
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

type GroupProps = {
  title: string;
  changes: readonly VersionChange[];
  states?: Record<string, RestoreState>;
  onRestore?: (change: VersionChange) => void;
};

function Group({ title, changes, states, onRestore }: GroupProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  if (changes.length === 0) return null;
  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="captionSemiBold">{title}</Text>
      {changes.map((change, index) => (
        <Fragment key={keyOf(change)}>
          {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
          <ChangeRow
            change={change}
            restoring={states?.[keyOf(change)]}
            onRestore={onRestore ? () => onRestore(change) : undefined}
          />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * What one version changed and why (toreview §146.5), loaded when its row opens: what went in or
 * was reworded, then what came out. A line the tailor's review took out because it doesn't serve
 * the job carries Restore, which puts it back on the resume as an ordinary edit (§202). Spec-derived from the app's text styles and rules.
 */
export function VersionChangeList({ resumeId, versionId }: VersionChangeListProps) {
  const { spacing, s } = useTheme();
  const changes = useVersionChanges(resumeId, versionId);
  const { states, restore } = useRestoreLine(resumeId);

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
        <Text variant="caption" color="textSecondary" align="center">
          We couldn’t load what changed. Check your connection and try again.
        </Text>
        <Button
          label="Try again"
          variant="ghost"
          onPress={() => void changes.refetch()}
          style={{ alignSelf: 'center' }}
        />
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
      <Group
        title="Left out"
        changes={changes.data.filter((c) => c.kind === 'removed')}
        states={states}
        onRestore={(change) => {
          if (change.restore) void restore(keyOf(change), change.restore);
        }}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  rule: { height: s(RULE) },
  restore: { alignSelf: 'flex-start' },
}));
