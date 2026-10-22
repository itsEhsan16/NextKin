import { useState, type JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import type { Job } from '@/data/models';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';

import { BuildJobCard, BuildJobRow } from './BuildJobRows';

export type AtsJobSheetProps = {
  open: boolean;
  jobs: readonly Job[];
  selectedId?: string;
  onPick: (jobId: string) => void;
  onClose: () => void;
};

// The picker borrows TAILOR 01's sheet geometry (606:142), at 390.
const TOP = 16 / 0.75;
const BOTTOM = 30 / 0.75;
const HEADER_TO_LIST = 14 / 0.75;
const LIST_TO_CTA = 22 / 0.75;
const CTA_HEIGHT = 48 / 0.75;
const CTA_RADIUS = 13.5 / 0.75;
const SHEET_FLOOR = 420 / 0.75;
const LIST_MAX_SHARE = 0.5;

const TITLE = 'Check against which job?';

/**
 * ATS 01's "Change" on the job row: the saved jobs as BUILD 02's radio rows, then Use this job.
 * Not drawn on the ATS boards (§69 says it reuses the standard job sheet), so it is assembled
 * from the job rows and sheet header the app already has.
 */
export function AtsJobSheetBody({
  jobs,
  selectedId,
  onPick,
  onClose,
}: Omit<AtsJobSheetProps, 'open'>) {
  const { spacing, s } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [pick, setPick] = useState(selectedId);
  const chosen = jobs.some((job) => job.id === pick) ? pick : jobs[0]?.id;

  return (
    <View
      style={{ paddingHorizontal: spacing.gutter, paddingTop: s(TOP), paddingBottom: s(BOTTOM) }}
    >
      <OptionSheetHeader
        variant="card"
        title={TITLE}
        subtitle="Your saved jobs"
        onClose={onClose}
      />
      <ScrollView
        style={{ flexGrow: 0, maxHeight: windowHeight * LIST_MAX_SHARE }}
        contentContainerStyle={{ paddingTop: s(HEADER_TO_LIST) }}
        showsVerticalScrollIndicator={false}
      >
        <BuildJobCard selectedIndex={jobs.findIndex((job) => job.id === chosen)}>
          {jobs.map((job) => (
            <BuildJobRow
              key={job.id}
              job={job}
              variant="radio"
              selected={job.id === chosen}
              onPress={() => setPick(job.id)}
            />
          ))}
        </BuildJobCard>
      </ScrollView>
      <Button
        label="Use this job"
        block
        disabled={chosen == null}
        onPress={() => {
          if (chosen) onPick(chosen);
        }}
        style={{ marginTop: s(LIST_TO_CTA), height: s(CTA_HEIGHT), borderRadius: s(CTA_RADIUS) }}
      />
    </View>
  );
}

export function AtsJobSheet({ open, ...body }: AtsJobSheetProps): JSX.Element {
  const { s } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={s(SHEET_FLOOR)}
      swipeToDismiss={false}
      accessibilityLabel={TITLE}
    >
      <AtsJobSheetBody {...body} />
    </Sheet>
  );
}
