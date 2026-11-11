import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import {
  useActivity,
  useCurrentUser,
  useDataExport,
  useProfile,
  useRequestDataExport,
  useResumes,
  useSavedJobs,
} from '@/data/queries';
import { shareFile, writeTextFile } from '@/lib';
import type { FlowArt } from '@/features/create/components/FlowHero';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Reveal, useRevealStagger } from '@/ui/motion';

import { AccountHero } from '../components/AccountHero';
import {
  DataExportContents,
  PrivacyPolicyLink,
  PrivacyPolicyRow,
} from '../components/DataExportContents';
import {
  DataExportFailedCard,
  DataExportFileCard,
  DataExportPreparingCard,
  DataExportSkeleton,
} from '../components/DataExportState';
import {
  buildDataExportPayload,
  dataExportBlock,
  dataExportJson,
  DATA_EXPORT_FAILED_NOTE,
  DATA_EXPORT_REQUEST_FAILED,
  DATA_EXPORT_SHARE_UNAVAILABLE,
  DATA_EXPORT_SHARED,
  DATA_EXPORT_TITLE,
  DATA_EXPORT_WRITE_FAILED,
} from '../dataExportCopy';
import { useAccountActions } from '../hooks/useAccountActions';

export type DataExportScreenProps = Record<string, never>;

const EXPORT_MIME = 'application/json';

// ACCOUNT 02 (577:3071) and ACCOUNT 03 (577:3801) at 390, in artboard units.
const HEADER_TO_HERO = 26 / 0.75;
const HERO_TO_CONTENTS = 28 / 0.75;
const HERO_TO_CARD = 26 / 0.75;
const CARD_GAP = 15 / 0.75;
const FILE_TO_LINK = 20 / 0.75;
/** ACCOUNT 03's drawing sits 40 under the bar (577:3802 → 680:92), 14 lower than the idle hero. */
const READY_ART_DROP = (40 - 26) / 0.75;

/** IL-A1 (680:92), the clay illustration (§211), fitted inside the board’s box: the box with the file rising out of it. */
const EXPORT_READY_ART: FlowArt = {
  source: require('../../../../assets/illustrations/account/export-ready.webp'),
  w: 290.7,
  h: 232,
  shiftX: 0,
  toTitle: 16, // 680:92 → 577:3816
};

/**
 * ACCOUNT — download your data (V2 §8.5). A person may take a copy of everything the product
 * holds about them, so this page is a right made real: it names what the file contains, says the
 * link expires, and links to the policy for what is held and why.
 *
 * Drawn as ACCOUNT 02 (idle, 577:3071) and ACCOUNT 03 (ready, 577:3801); preparing and failed
 * have no board and reuse the idle page's hero and cards. ACCOUNT 03 opens on its own drawing
 * (IL-A1), the folder handing the file over.
 *
 * The export's own four states — idle, preparing, ready, failed — are the page's content. Around
 * them sit the usual three: a skeleton while the first status read is in flight (with the bar
 * pinned and inert, because the bar owns the bottom inset and the viewport must not resize under
 * the reader), and a danger state if that read fails. There is deliberately NO empty state: an
 * export status is a machine, never a list, so "nothing here" is not a reading it can be in —
 * `idle` is the page with no export yet, and it is a full explainer rather than a blank.
 */
export function DataExportScreen(_props: DataExportScreenProps = {}) {
  const { spacing, s } = useTheme();
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

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!status.isPending);

  // An archive that finishes building while the user waits on this page is felt as well as seen.
  const exportStatus = status.data?.status;
  const sawPreparing = useRef(false);
  useEffect(() => {
    if (exportStatus === 'preparing') sawPreparing.current = true;
    if (exportStatus === 'ready' && sawPreparing.current) sawPreparing.current = false;
  }, [exportStatus]);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={DATA_EXPORT_TITLE} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
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
        icon="AlertTriangle"
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

  const failed = current.status === 'failed';

  return page(
    <>
      <Animated.View entering={enter(0)} style={ready ? { marginTop: s(READY_ART_DROP) } : null}>
        {/* Each state cross-fades into the next (requested → building → ready), so the ready
            drawing and its file arrive instead of cutting in (§85). */}
        <Reveal stateKey={current.status}>
          {failed ? (
            <DataExportFailedCard status={current} />
          ) : (
            <AccountHero
              art={ready ? undefined : PROFILE_ROW_ART.exportData}
              image={ready ? EXPORT_READY_ART : undefined}
              artWidth={72}
              artGap={16}
              title={block.title}
              lede={block.body}
            />
          )}
        </Reveal>
      </Animated.View>

      <Animated.View
        entering={enter(1)}
        style={{
          marginTop: s(
            failed ? CARD_GAP : current.status === 'idle' ? HERO_TO_CONTENTS : HERO_TO_CARD,
          ),
        }}
      >
        <Reveal stateKey={current.status}>
          {current.status === 'idle' ? <DataExportContents /> : null}
          {preparing ? <DataExportPreparingCard label={block.title} /> : null}
          {ready ? <DataExportFileCard status={current} /> : null}
        </Reveal>
      </Animated.View>

      <Animated.View entering={enter(2)} style={{ marginTop: s(ready ? FILE_TO_LINK : CARD_GAP) }}>
        {ready ? (
          <PrivacyPolicyLink onPress={actions.openPrivacy} />
        ) : (
          <PrivacyPolicyRow onPress={actions.openPrivacy} />
        )}
      </Animated.View>
    </>,
    <StickyActionBar
      note={barNote}
      noteTone={barNote && barNote !== DATA_EXPORT_SHARED ? 'danger' : 'neutral'}
      primary={
        ready
          ? {
              label: block.cta,
              icon: 'Download01',
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
