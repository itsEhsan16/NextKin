import { View } from 'react-native';

import type { JdInput } from '@/data/models';
import { useSavedJobs } from '@/data/queries';
import { useTheme } from '@/theme';
import { OptionSheetBody, OptionSheetHeader, type SheetOption } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { useCreateStore } from '../createStore';

export type JdIntakeSheetsProps = {
  value: JdInput | null;
  onChange: (input: JdInput | null) => void;
};

const TITLE = 'Choose a saved job';
const SKELETON_ROWS = [0, 1, 2];
const SKELETON_ROW_HEIGHT = 44;

/**
 * The saved-job picker `JdIntakeSection` raises (V2 §7.5).
 *
 * Mounted BESIDE `<Screen>`, never inside it: a `Sheet` is an absoluteFill overlay, so one
 * rendered in the page's scroller would scrim the scrolling content instead of the window and
 * dock its panel to the bottom of the content rather than the bottom of the glass.
 */
export function JdIntakeSheets({ value, onChange }: JdIntakeSheetsProps) {
  const { sizes, spacing, s } = useTheme();
  const open = useCreateStore((state) => state.jobSheetOpen);
  const close = useCreateStore((state) => state.closeJobSheet);
  const savedJobs = useSavedJobs();

  const options: SheetOption[] = (savedJobs.data ?? []).map((job) => ({
    key: job.id,
    label: job.title,
    caption: job.company,
  }));

  const padded = { paddingHorizontal: spacing.gutter, paddingBottom: spacing[4] };

  return (
    <Sheet open={open} onClose={close} height={sizes.sheetPickerHeight} accessibilityLabel={TITLE}>
      {savedJobs.isPending ? (
        // The list's own header row, so the title sits where it will once the jobs arrive.
        <View style={[padded, { gap: spacing[4] }]}>
          <OptionSheetHeader title={TITLE} onClose={close} />
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} height={s(SKELETON_ROW_HEIGHT)} radius="card" />
          ))}
        </View>
      ) : savedJobs.isError ? (
        <View style={padded}>
          <StateView
            tone="danger"
            icon="AlertTriangle"
            title="Couldn't load your saved jobs"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void savedJobs.refetch()}
          />
        </View>
      ) : options.length === 0 ? (
        <View style={padded}>
          <StateView
            icon="Bookmark"
            title="No saved jobs yet"
            message="Save one from the Jobs tab."
            actionLabel="Close"
            onAction={close}
          />
        </View>
      ) : (
        <OptionSheetBody
          title={TITLE}
          options={options}
          selectedKey={value?.source === 'job' ? value.jobId : undefined}
          onSelect={(id) => {
            onChange({ source: 'job', jobId: id });
            close();
          }}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
