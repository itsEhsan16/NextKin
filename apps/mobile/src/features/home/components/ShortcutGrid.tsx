import { useMemo } from 'react';
import type { SvgProps } from 'react-native-svg';

import AiAssistantIcon from '../../../../assets/icons/shortcuts/ai-assistant.svg';
import HistoryIcon from '../../../../assets/icons/shortcuts/history.svg';
import InterviewPrepIcon from '../../../../assets/icons/shortcuts/interview-prep.svg';
import MyResumesIcon from '../../../../assets/icons/shortcuts/my-resumes.svg';
import SavedJobsIcon from '../../../../assets/icons/shortcuts/saved-jobs.svg';
import type { DashboardStats } from '@/data/models';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
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

/**
 * The bare number shown above the icon, for the three shortcuts that carry one. A blank string
 * holds the row while stats load so the icons do not jump when the value lands; `undefined` means
 * this shortcut has no number at all.
 */
function count(key: Shortcut, stats: DashboardStats | undefined): string | undefined {
  switch (key) {
    case 'my-resumes':
      return stats ? String(stats.resumesCount) : ' ';
    case 'history':
      return stats ? String(stats.activitiesCount) : ' ';
    case 'saved-jobs':
      return stats ? String(stats.savedJobsCount) : ' ';
    case 'interview-prep':
    case 'ai-assistant':
      return undefined;
  }
}

/** What the number means, spoken. The tiles without one fall back to their standing hint. */
function spokenValue(key: Shortcut, stats: DashboardStats | undefined): string | undefined {
  if (!stats) return undefined;
  switch (key) {
    case 'my-resumes':
      return pluralize(stats.resumesCount, 'Resume');
    case 'history':
      return pluralize(stats.activitiesCount, 'Activity', 'Activities');
    case 'saved-jobs':
      return `${stats.savedJobsCount} Saved`;
    case 'interview-prep':
    case 'ai-assistant':
      return undefined;
  }
}

function hint(key: Shortcut): string | undefined {
  if (key === 'interview-prep') return 'AI Questions';
  if (key === 'ai-assistant') return 'Ask Anything';
  return undefined;
}

export function ShortcutGrid({ stats, onShortcut }: ShortcutGridProps) {
  const { s } = useTheme();

  const items = useMemo<IconTile<Shortcut>[]>(
    () =>
      SPECS.map(({ key, label, render, w, h }) => ({
        key,
        label,
        count: count(key, stats),
        countLabel: spokenValue(key, stats),
        a11yHint: hint(key),
        icon: render({ width: s(w), height: s(h) }),
      })),
    [s, stats],
  );

  return (
    <Card style={{ paddingTop: s(28), paddingBottom: s(20), paddingHorizontal: s(20) }}>
      {/*
        Five tiles across a 390 frame leaves ~64pt a cell. The label wraps to two lines so only
        its longest word has to fit there, and the counter sits above the icon instead of under
        the label, where it would have been fighting for the same room — see `shortcutLabel` in
        src/theme/typography.ts.
      */}
      <IconTileGrid items={items} onPress={onShortcut} iconBoxHeight={s(ICON_ROW)} />
    </Card>
  );
}
