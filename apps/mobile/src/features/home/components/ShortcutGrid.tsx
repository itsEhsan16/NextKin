import { useMemo } from 'react';
import type { SvgProps } from 'react-native-svg';

import AiAssistantIcon from '../../../../assets/icons/shortcuts/ai-assistant.svg';
import HistoryIcon from '../../../../assets/icons/shortcuts/history.svg';
import InterviewPrepIcon from '../../../../assets/icons/shortcuts/interview-prep.svg';
import MyResumesIcon from '../../../../assets/icons/shortcuts/my-resumes.svg';
import SavedJobsIcon from '../../../../assets/icons/shortcuts/saved-jobs.svg';
import type { DashboardStats } from '@/data/models';
import { pluralize } from '@/lib';
import { useLayoutScale } from '@/theme';
import { Card } from '@/ui/Card';
import { IconTileGrid, type IconTile } from '@/ui/IconTileGrid';

export type Shortcut = 'my-resumes' | 'history' | 'saved-jobs' | 'interview-prep' | 'ai-assistant';

export type ShortcutGridProps = {
  stats: DashboardStats | undefined;
  onShortcut: (shortcut: Shortcut) => void;
};

type Spec = {
  key: Shortcut;
  label: string;
  render: (props: SvgProps) => React.ReactElement;
  w: number;
  h: number;
};

/** Figma 1:184 — five shortcuts; the first three carry live counters. */
const SPECS: readonly Spec[] = [
  { key: 'my-resumes', label: 'My Resumes', render: (p) => <MyResumesIcon {...p} />, w: 45, h: 44 },
  { key: 'history', label: 'History', render: (p) => <HistoryIcon {...p} />, w: 45, h: 45 },
  { key: 'saved-jobs', label: 'Saved Jobs', render: (p) => <SavedJobsIcon {...p} />, w: 34, h: 45 },
  {
    key: 'interview-prep',
    label: 'Interview Prep',
    render: (p) => <InterviewPrepIcon {...p} />,
    w: 51,
    h: 51,
  },
  {
    key: 'ai-assistant',
    label: 'AI Assistant',
    render: (p) => <AiAssistantIcon {...p} />,
    w: 45,
    h: 45,
  },
];

/** Figma places the label baseline 56px into the item box. */
const ICON_ROW = 56;

function subLabel(key: Shortcut, stats: DashboardStats | undefined): string | undefined {
  switch (key) {
    case 'my-resumes':
      return stats ? pluralize(stats.resumesCount, 'Resume') : undefined;
    case 'history':
      return stats ? pluralize(stats.activitiesCount, 'Activity', 'Activities') : undefined;
    case 'saved-jobs':
      return stats ? `${stats.savedJobsCount} Saved` : undefined;
    case 'interview-prep':
      return 'AI Questions';
    case 'ai-assistant':
      return 'Ask Anything';
  }
}

export function ShortcutGrid({ stats, onShortcut }: ShortcutGridProps) {
  const { s } = useLayoutScale();

  const items = useMemo<IconTile<Shortcut>[]>(
    () =>
      SPECS.map(({ key, label, render, w, h }) => ({
        key,
        label,
        // Blank (not absent) while counters load, so the tile height stays put.
        sublabel: subLabel(key, stats) ?? ' ',
        icon: render({ width: s(w), height: s(h) }),
      })),
    [s, stats],
  );

  return (
    <Card style={{ paddingTop: s(28), paddingBottom: s(20), paddingHorizontal: s(20) }}>
      <IconTileGrid items={items} onPress={onShortcut} iconBoxHeight={s(ICON_ROW)} />
    </Card>
  );
}
