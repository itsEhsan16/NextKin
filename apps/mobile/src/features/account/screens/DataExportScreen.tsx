import { useCallback, useState, type ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  useActivity,
  useCurrentUser,
  useDataExport,
  useProfile,
  useRequestDataExport,
  useResumes,
  useSavedJobs,
} from '@/data/queries';
import { shareFile, useReducedMotion, writeTextFile } from '@/lib';
import { useTheme } from '@/theme';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { DataExportSkeleton, DataExportState } from '../components/DataExportState';
import {
  buildDataExportPayload,
  dataExportBlock,
  dataExportJson,
  DATA_EXPORT_FAILED_NOTE,
  DATA_EXPORT_PRIVACY_NOTE,
  DATA_EXPORT_REQUEST_FAILED,
  DATA_EXPORT_SHARE_UNAVAILABLE,
  DATA_EXPORT_SHARED,
  DATA_EXPORT_TITLE,
  DATA_EXPORT_WRITE_FAILED,
} from '../dataExportCopy';
import { useAccountActions } from '../hooks/useAccountActions';

export type DataExportScreenProps = Record<string, never>;

const EXPORT_MIME = 'application/json';

/**
 * ACCOUNT — download your data (V2 §8.5). A person may take a copy of everything the product
 * holds about them, so this page is a right made real: it names what the file contains, says the
 * link expires, and links to the policy for what is held and why.
 *
 * No artboard draws it (plan §8, phase 9G), so it is assembled from the built primitives alone.
 *
 * The export's own four states — idle, preparing, ready, failed — are the page's content. Around
 * them sit the usual three: a skeleton while the first status read is in flight (with the bar
 * pinned and inert, because the bar owns the bottom inset and the viewport must not resize under
 * the reader), and a danger state if that read fails. There is deliberately NO empty state: an
 * export status is a machine, never a list, so "nothing here" is not a reading it can be in —
 * `idle` is the page with no export yet, and it is a full explainer rather than a blank.
 */
export function DataExportScreen(_props: DataExportScreenProps = {}) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const actions = useAccountActions();

  const status = useDataExport();
  const request = useRequestDataExport();

  // The sections the file is assembled from. The repo hands back no bytes — the real API will
  // return a presigned URL through the same shape — so the file is built here, from exactly what
  // the app can read through its own hooks. A section that has not loaded is recorded as missing
  // in the payload rather than silently written out as empty.
  const user = useCurrentUser();
  const profile = useProfile();
  const resumes = useResumes();
  const savedJobs = useSavedJobs();
  const activity = useActivity();

  const [note, setNote] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const fileName = status.data?.fileName;

  const download = useCallback(async () => {
    if (!fileName) return;
    setSaving(true);
    setNote(undefined);
    try {
      const payload = buildDataExportPayload({
        user: user.data,
        profile: profile.data,
        resumes: resumes.data,
        savedJobs: savedJobs.data,
        activity: activity.data,
      });
      const written = await writeTextFile(fileName, dataExportJson(payload));
      // Both wrappers degrade rather than throw, so each silent failure gets a sentence.
      if (!written) {
        setNote(DATA_EXPORT_WRITE_FAILED);
        return;
      }
      const shared = await shareFile(written.uri, {
        mimeType: EXPORT_MIME,
        dialogTitle: `Save ${written.name}`,
      });
      setNote(shared === 'unavailable' ? DATA_EXPORT_SHARE_UNAVAILABLE : DATA_EXPORT_SHARED);
    } finally {
      setSaving(false);
    }
  }, [activity.data, fileName, profile.data, resumes.data, savedJobs.data, user.data]);

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={DATA_EXPORT_TITLE} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      footer={footer}
    >
      {children}
    </Screen>
  );

  if (status.isPending) {
    return page(
      <DataExportSkeleton />,
      <StickyActionBar primary={{ label: 'Request export', disabled: true }} />,
    );
  }

  if (status.isError || !status.data) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't check your export"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void status.refetch()}
      />,
    );
  }

  const current = status.data;
  const block = dataExportBlock(current);
  const ready = current.status === 'ready';
  const preparing = current.status === 'preparing';

  const barNote =
    note ??
    (request.isError
      ? DATA_EXPORT_REQUEST_FAILED
      : current.status === 'failed'
        ? DATA_EXPORT_FAILED_NOTE
        : undefined);

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <DataExportState status={current} />
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ gap: spacing[3] }}>
        <Text variant="caption" color="textSecondary">
          {DATA_EXPORT_PRIVACY_NOTE}
        </Text>
        <RowGroup>
          <ListRow icon="shield-alt" label="Privacy policy" onPress={actions.openPrivacy} />
        </RowGroup>
      </Animated.View>
    </>,
    <StickyActionBar
      note={barNote}
      primary={
        ready
          ? {
              label: block.cta,
              icon: 'file-download',
              loading: saving,
              onPress: () => void download(),
            }
          : preparing
            ? { label: block.cta, loading: true }
            : { label: block.cta, loading: request.isPending, onPress: () => request.mutate() }
      }
    />,
  );
}

