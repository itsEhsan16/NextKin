import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { ResumeVersion } from '@/data/models';
import { queryPhase, useResumeVersions } from '@/data/queries';
import { formatRelativeTimeLong } from '@/lib';
import { useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { VersionChangeList } from '../components/VersionChangeList';
import { useResumesActions } from '../hooks/useResumesActions';

export type ResumeVersionsScreenProps = { id: string };

const versionTitle = (version: ResumeVersion) =>
  `Version ${version.version} · ${formatRelativeTimeLong(version.createdAt)}`;

/**
 * What changed and why (owner, 2026-11-01, toreview §146.5): the resume's versions, newest first,
 * each opening on the lines it added, reworded or left out, and the reason. The newest starts
 * open, because that's what someone comes here to read. Spec-derived (V2 §7.11) from the app's
 * disclosure rows; web's Versions tab shows the same list.
 */
export function ResumeVersionsScreen({ id }: ResumeVersionsScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useResumesActions();
  const versions = useResumeVersions(id);
  const newest = versions.data?.[0]?.id;
  const [opened, setOpened] = useState<string | null | undefined>(undefined);
  const open = opened === undefined ? newest : opened;
  const status = queryPhase(versions);

  const page = (children: ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Versions" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[2] }}
    >
      {children}
    </Screen>
  );

  if (status === 'pending') {
    return page(
      <View accessible accessibilityLabel="Loading versions" style={{ gap: spacing[3] }}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} height={s(64)} radius="card" />
        ))}
      </View>,
    );
  }

  if (status === 'error') {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your versions"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void versions.refetch()}
      />,
    );
  }

  if (!versions.data?.length) {
    return page(
      <StateView
        art="noHistory"
        icon="ClockRewind"
        title="No versions yet"
        message="Each change to this resume is kept here."
      />,
    );
  }

  return page(
    versions.data.map((version) => (
      <Disclosure
        key={version.id}
        mode="row"
        title={versionTitle(version)}
        expanded={open === version.id}
        onToggle={() => setOpened(open === version.id ? null : version.id)}
      >
        <View style={{ gap: spacing[3] }}>
          {version.changeNote ? <Text variant="captionSemiBold">{version.changeNote}</Text> : null}
          <VersionChangeList resumeId={id} versionId={version.id} />
        </View>
      </Disclosure>
    )),
  );
}
